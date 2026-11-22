// ==========================================================================
// MATEANDO - LÓGICA PRINCIPAL DE LA APLICACIÓN
// ==========================================================================

const AppState = {
  currentUser: null,
  savedGroups: [],

  // Configuración de la sesión
  currentGroup: {
    name: "Ronda Casual",
    participants: [],
    holdingTimeSeconds: 60,
    deliveryMode: "circle", // "circle" o "random"
    termoCapacity: 20, // Cantidad de mates por termo (0 = sin límite)
    soundType: "pava", // "pava" o "campana"
    savedGroupId: null,
  },

  // Estado del juego / Ronda activa
  activeSession: {
    isActive: false,
    roundNumber: 1,
    totalMates: 0,
    startTime: null,
    currentTurnIndex: 0,
    roundOrder: [], // Orden de índices de participantes para la ronda actual
    state: "READY_TO_DELIVER", // "READY_TO_DELIVER" | "DRINKING"
    timerRemaining: 60,
    timerInterval: null,
    termoMatesLeft: 10,
    termoRefillCount: 0,
  },
};

// ---------------- INICIALIZACIÓN ----------------
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await checkExistingUser();
  await loadSavedGroups();
});

// ---------------- VERIFICAR USUARIO / API ----------------
async function checkExistingUser() {
  try {
    const res = await fetch("/api/users/current");
    const data = await res.json();
    if (data.user) {
      AppState.currentUser = data.user;
      updateUserChip(data.user);
    }
  } catch (err) {
    console.warn("No se pudo cargar el usuario actual:", err);
  }
}

async function loadSavedGroups() {
  try {
    const res = await fetch("/api/groups");
    const data = await res.json();
    if (data.groups) {
      AppState.savedGroups = data.groups;
    }
  } catch (err) {
    console.warn("No se pudieron cargar los grupos guardados:", err);
  }
}

function updateUserChip(user) {
  const userChip = document.getElementById("user-chip");
  const userNameSpan = document.getElementById("user-chip-name");
  const userAvatar = document.getElementById("user-chip-avatar");
  if (userChip && userNameSpan) {
    userNameSpan.textContent = user.name || user.username;
    if (userAvatar) {
      userAvatar.textContent = (user.name ||
        user.username ||
        "C")[0].toUpperCase();
    }
    userChip.style.display = "flex";
  }
}

// ---------------- NAVEGACIÓN ENTRE PANTALLAS ----------------
function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// ---------------- CONFIGURACIÓN DE EVENT LISTENERS ----------------
function setupEventListeners() {
  // Pantalla 1: Bienvenida
  document.getElementById("btn-first-time").addEventListener("click", () => {
    showScreen("screen-register");
  });

  document.getElementById("btn-ready-mate").addEventListener("click", () => {
    if (!AppState.currentUser) {
      AppState.currentUser = { name: "Cebador", username: "cebador_invitado" };
      updateUserChip(AppState.currentUser);
    }
    showScreen("screen-menu");
  });

  // Pantalla 2: Registro
  document
    .getElementById("form-register")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-name").value.trim();
      const age = parseInt(document.getElementById("reg-age").value) || null;
      const username = document.getElementById("reg-username").value.trim();

      if (!name || !username) {
        showToast("Por favor completa nombre y usuario");
        return;
      }

      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, age, username, auth_provider: "local" }),
        });
        const data = await res.json();
        if (data.user) {
          AppState.currentUser = data.user;
          updateUserChip(data.user);
          showToast(`¡Bienvenido, ${data.user.name}! 🧉`);
          showScreen("screen-menu");
        }
      } catch (err) {
        showToast("Error al guardar usuario");
      }
    });

  // Continuar con Google
  document
    .getElementById("btn-google-login")
    .addEventListener("click", async () => {
      try {
        const res = await fetch("/api/users/google-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Cebador Google",
            email: "cebador.mateando@gmail.com",
          }),
        });
        const data = await res.json();
        if (data.user) {
          AppState.currentUser = data.user;
          updateUserChip(data.user);
          showToast("Ingresaste con Google exitosamente 🧉");
          showScreen("screen-menu");
        }
      } catch (err) {
        showToast("Error en inicio con Google");
      }
    });

  // Pantalla 3: Menú de Rondas
  document
    .getElementById("btn-menu-nueva-ronda")
    .addEventListener("click", () => {
      initNewRoundForm();
      showScreen("screen-config");
    });

  document
    .getElementById("btn-menu-ronda-guardada")
    .addEventListener("click", () => {
      openSavedGroupsModal();
    });

  document
    .getElementById("btn-menu-ronda-rapida")
    .addEventListener("click", () => {
      initQuickRound();
      showScreen("screen-config");
    });

  // Pantalla 4: Configuración de Ronda
  document
    .getElementById("btn-add-participant")
    .addEventListener("click", () => {
      addParticipantRow();
    });

  document.getElementById("btn-preview-sound").addEventListener("click", () => {
    const sound = document.getElementById("config-alarm-sound").value;
    window.mateAudio.previewSound(sound);
    showToast(
      sound === "pava"
        ? "🫖 Probando silbido de pava..."
        : "🔔 Probando campanilla...",
    );
  });

  document.getElementById("btn-start-cebada").addEventListener("click", () => {
    startCebadaSession();
  });

  document.getElementById("btn-config-back").addEventListener("click", () => {
    showScreen("screen-menu");
  });

  // Pantalla 5: Acciones del Cebador
  document.getElementById("btn-deliver-mate").addEventListener("click", () => {
    handleMateDelivered();
  });

  document.getElementById("btn-receive-mate").addEventListener("click", () => {
    handleMateReceived();
  });

  document.getElementById("btn-refill-termo").addEventListener("click", () => {
    handleRefillTermo();
  });

  document
    .getElementById("btn-finish-mateada")
    .addEventListener("click", () => {
      confirmFinishMateada();
    });

  // Modal de grupos guardados
  document
    .getElementById("btn-close-saved-modal")
    .addEventListener("click", () => {
      document.getElementById("modal-saved-groups").classList.remove("active");
    });

  // Modal de resumen final
  document
    .getElementById("btn-close-summary-modal")
    .addEventListener("click", () => {
      document.getElementById("modal-summary").classList.remove("active");
      showScreen("screen-menu");
    });

  // Botón de silenciar/activar alarma
  const btnMute = document.getElementById("btn-toggle-sound");
  if (btnMute) {
    btnMute.addEventListener("click", () => {
      const isMuted = window.mateAudio.toggleMute();
      btnMute.textContent = isMuted ? "🔇 Silenciado" : "🔊 Alarma Activa";
      btnMute.classList.toggle("is-muted", isMuted);
    });
  }

  // Logo click vuelve al menú
  document.getElementById("brand-badge").addEventListener("click", () => {
    if (AppState.activeSession.isActive) {
      if (
        confirm("Hay una mateada en curso. ¿Deseas volver al menú principal?")
      ) {
        stopActiveTimer();
        AppState.activeSession.isActive = false;
        showScreen("screen-menu");
      }
    } else {
      showScreen("screen-menu");
    }
  });
}

// ---------------- GESTIÓN DEL FORMULARIO DE NUEVA RONDA ----------------
function initNewRoundForm() {
  document.getElementById("config-group-name").value = "";
  document.getElementById("config-save-checkbox").checked = false;
  document.getElementById("config-alarm-time").value = "1";
  document.getElementById("config-delivery-mode").value = "circle";
  document.getElementById("config-alarm-sound").value = "pava";
  document.getElementById("config-termo-capacity").value = "10";

  const container = document.getElementById("participants-container");
  container.innerHTML = "";

  const defaultCebadorName = AppState.currentUser
    ? AppState.currentUser.name
    : "Cebador";
  addParticipantRow(defaultCebadorName, true, 1);
  addParticipantRow("Jorge", false, 1);
  addParticipantRow("Lucía", false, 1);
  addParticipantRow("Martín", false, 2);
}

function initQuickRound() {
  document.getElementById("config-group-name").value = "Ronda Rápida";
  document.getElementById("config-save-checkbox").checked = false;
  document.getElementById("config-alarm-time").value = "1";
  document.getElementById("config-delivery-mode").value = "circle";
  document.getElementById("config-alarm-sound").value = "pava";
  document.getElementById("config-termo-capacity").value = "10";

  const container = document.getElementById("participants-container");
  container.innerHTML = "";

  const cebador = AppState.currentUser ? AppState.currentUser.name : "Cebador";
  addParticipantRow(cebador, true, 1);
  addParticipantRow("Compañero 1", false, 1);
  addParticipantRow("Compañero 2", false, 1);
}

function addParticipantRow(name = "", isCebador = false, frequency = 1) {
  const container = document.getElementById("participants-container");
  const index = container.children.length;

  const row = document.createElement("div");
  row.className = "participant-item";
  row.dataset.index = index;

  row.innerHTML = `
        <div class="participant-item-fields">
            <input type="text" class="form-input participant-name-input" placeholder="Nombre (ej. Jorge)" value="${name}">
            <div class="participant-item-row2">
                <label class="cebador-radio-label">
                    <input type="radio" name="cebador-selection" ${isCebador ? "checked" : ""}>
                    <span>Es el cebador 🧉 (Toma también)</span>
                </label>
                <select class="frequency-select">
                    <option value="1" ${frequency === 1 ? "selected" : ""}>Toma todas las rondas</option>
                    <option value="2" ${frequency === 2 ? "selected" : ""}>Saltea 1 vuelta (toma cada 2)</option>
                    <option value="3" ${frequency === 3 ? "selected" : ""}>Saltea 2 vueltas (toma cada 3)</option>
                </select>
            </div>
        </div>
        <button type="button" class="btn-remove-person" title="Eliminar participante">✕</button>
    `;

  row.querySelector(".btn-remove-person").addEventListener("click", () => {
    if (container.children.length <= 2) {
      showToast("La ronda debe tener al menos 2 personas");
      return;
    }
    row.remove();
    ensureAtLeastOneCebador();
  });

  container.appendChild(row);

  if (isCebador) {
    const radios = container.querySelectorAll(
      'input[name="cebador-selection"]',
    );
    radios.forEach((r) => {
      if (r !== row.querySelector('input[name="cebador-selection"]')) {
        r.checked = false;
      }
    });
  }
}

function ensureAtLeastOneCebador() {
  const container = document.getElementById("participants-container");
  const radios = container.querySelectorAll('input[name="cebador-selection"]');
  const hasChecked = Array.from(radios).some((r) => r.checked);
  if (!hasChecked && radios.length > 0) {
    radios[0].checked = true;
  }
}

// ---------------- INICIAR SESIÓN DE CEBADA ----------------
async function startCebadaSession() {
  const container = document.getElementById("participants-container");
  const rows = container.querySelectorAll(".participant-item");

  const participants = [];
  rows.forEach((row, idx) => {
    const nameInput = row.querySelector(".participant-name-input");
    const name = nameInput.value.trim() || `Participante ${idx + 1}`;
    const isCebador = row.querySelector(
      'input[name="cebador-selection"]',
    ).checked;
    const frequency =
      parseInt(row.querySelector(".frequency-select").value) || 1;

    participants.push({
      id: idx,
      name: name,
      isCebador: isCebador,
      frequency: frequency,
      optedOut: false,
      matesTaken: 0,
    });
  });

  if (participants.length < 2) {
    showToast("Agrega al menos 2 personas para comenzar");
    return;
  }

  const alarmTimeMin =
    parseFloat(document.getElementById("config-alarm-time").value) || 1;
  const holdingTimeSeconds = Math.round(alarmTimeMin * 60);
  const deliveryMode = document.getElementById("config-delivery-mode").value;
  const soundType =
    document.getElementById("config-alarm-sound").value || "pava";
  const termoCapacity =
    parseInt(document.getElementById("config-termo-capacity").value) || 10;
  const groupNameInput = document
    .getElementById("config-group-name")
    .value.trim();
  const shouldSaveGroup = document.getElementById(
    "config-save-checkbox",
  ).checked;

  window.mateAudio.setSoundType(soundType);

  AppState.currentGroup = {
    name: groupNameInput || "Ronda de Mate",
    participants: participants,
    holdingTimeSeconds: holdingTimeSeconds,
    deliveryMode: deliveryMode,
    termoCapacity: termoCapacity,
    soundType: soundType,
    savedGroupId: null,
  };

  if (shouldSaveGroup && groupNameInput) {
    try {
      await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: groupNameInput,
          members: participants.map((p) => ({
            name: p.name,
            is_cebador: p.isCebador,
            frequency: p.frequency,
          })),
        }),
      });
      await loadSavedGroups();
      showToast("Grupo guardado para futuras mateadas 💾");
    } catch (err) {
      console.error("Error al guardar grupo:", err);
    }
  }

  AppState.activeSession = {
    isActive: true,
    roundNumber: 1,
    totalMates: 0,
    startTime: new Date(),
    currentTurnIndex: 0,
    roundOrder: [],
    state: "READY_TO_DELIVER",
    timerRemaining: holdingTimeSeconds,
    timerInterval: null,
    termoMatesLeft: termoCapacity,
    termoRefillCount: 0,
  };

  prepareRoundOrder();
  renderActiveCebadaScreen();
  showScreen("screen-cebada");
}

// ---------------- GENERADOR DE TURNOS Y RONDAS ----------------
function prepareRoundOrder() {
  const { roundNumber, participants, deliveryMode } = {
    roundNumber: AppState.activeSession.roundNumber,
    participants: AppState.currentGroup.participants,
    deliveryMode: AppState.currentGroup.deliveryMode,
  };

  const eligibleIndices = [];
  participants.forEach((p, idx) => {
    if (!p.optedOut) {
      const isTurnThisRound = (roundNumber - 1) % p.frequency === 0;
      if (isTurnThisRound) {
        eligibleIndices.push(idx);
      }
    }
  });

  if (eligibleIndices.length === 0) {
    const activeCount = participants.filter((p) => !p.optedOut).length;
    if (activeCount === 0) {
      showToast(
        "Todos los integrantes han dicho 'No quiero más'. Finalizando mateada.",
      );
      confirmFinishMateada();
      return;
    }
    AppState.activeSession.roundNumber++;
    prepareRoundOrder();
    return;
  }

  if (deliveryMode === "random") {
    const shuffled = [...eligibleIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    AppState.activeSession.roundOrder = shuffled;
  } else {
    AppState.activeSession.roundOrder = eligibleIndices;
  }

  AppState.activeSession.currentTurnIndex = 0;
}

function getCurrentDrinker() {
  const { roundOrder, currentTurnIndex } = AppState.activeSession;
  if (roundOrder.length === 0 || currentTurnIndex >= roundOrder.length) {
    return null;
  }
  const participantIndex = roundOrder[currentTurnIndex];
  return AppState.currentGroup.participants[participantIndex];
}

// ---------------- RENDERIZAR TABLERO DE CEBADA ----------------
function renderActiveCebadaScreen() {
  const { activeSession, currentGroup } = AppState;
  const drinker = getCurrentDrinker();

  if (!drinker) {
    advanceToNextRound();
    return;
  }

  document.getElementById("active-round-label").textContent =
    `Ronda #${activeSession.roundNumber}`;
  document.getElementById("active-total-mates").textContent =
    `🧉 ${activeSession.totalMates} mates servidos`;

  const turnCard = document.querySelector(".current-turn-card");
  const nameEl = document.getElementById("current-drinker-name");
  const roleEl = document.getElementById("current-drinker-role");
  const turnTag = turnCard.querySelector(".turn-tag");

  const isCebador = drinker.isCebador;

  if (isCebador) {
    turnCard.classList.add("is-cebador-turn");
    turnTag.textContent = "¡Tu turno de tomar! 🧉";
    nameEl.textContent = `${drinker.name} (Cebador)`;
    roleEl.textContent = "¡Cebador oficial, tomate este mate vos!";
  } else {
    turnCard.classList.remove("is-cebador-turn");
    turnTag.textContent = "Turno Actual";
    nameEl.textContent = drinker.name;
    roleEl.textContent = "Tomador en la ronda";
  }

  const btnDeliver = document.getElementById("btn-deliver-mate");
  const btnReceive = document.getElementById("btn-receive-mate");

  if (activeSession.state === "READY_TO_DELIVER") {
    btnDeliver.style.display = "inline-flex";
    btnDeliver.querySelector(".btn-text").textContent = isCebador
      ? "Tomarme este mate (Cebador) 🧉"
      : `Entregar mate a ${drinker.name}`;
    btnReceive.style.display = "none";
    resetTimerDisplay();
  } else {
    btnDeliver.style.display = "none";
    btnReceive.style.display = "inline-flex";
    btnReceive.querySelector(".btn-text").textContent = isCebador
      ? "Terminé mi mate (Continuar ronda) ✅"
      : `Recibí mate de ${drinker.name}`;
  }

  updateTermoDisplay();
  renderRosterList();
}

// ---------------- GESTIÓN DEL NIVEL DEL TERMO ----------------
function updateTermoDisplay() {
  const { termoCapacity } = AppState.currentGroup;
  const { termoMatesLeft } = AppState.activeSession;

  const widget = document.getElementById("termo-widget");
  const label = document.getElementById("termo-mates-left-label");
  const fill = document.getElementById("termo-gauge-fill");

  if (!widget || !label || !fill) return;

  if (termoCapacity === 0) {
    // Agua ilimitada
    label.textContent = "Agua ilimitada ♾️";
    fill.style.width = "100%";
    fill.classList.remove("low", "empty");
    return;
  }

  label.textContent = `${termoMatesLeft}/${termoCapacity} mates`;
  const percent = Math.max(
    0,
    Math.min(100, (termoMatesLeft / termoCapacity) * 100),
  );
  fill.style.width = `${percent}%`;

  fill.classList.remove("low", "empty");
  if (termoMatesLeft === 0) {
    fill.classList.add("empty");
  } else if (percent <= 30) {
    fill.classList.add("low");
  }
}

function handleRefillTermo() {
  AppState.activeSession.termoMatesLeft = AppState.currentGroup.termoCapacity;
  AppState.activeSession.termoRefillCount++;
  window.mateAudio.playTermoRefill();
  updateTermoDisplay();
  showToast(
    "🫖 ¡Termo recargado con agua caliente! Listo para seguir cebando.",
  );
}

function renderRosterList() {
  const rosterList = document.getElementById("active-roster-list");
  rosterList.innerHTML = "";

  const { participants } = AppState.currentGroup;
  const { roundOrder, currentTurnIndex, roundNumber } = AppState.activeSession;
  const currentDrinkerIndex = roundOrder[currentTurnIndex];

  participants.forEach((p, idx) => {
    const row = document.createElement("li");
    row.className = "roster-row";

    const isCurrent = idx === currentDrinkerIndex;
    const isEligibleThisRound = (roundNumber - 1) % p.frequency === 0;

    if (p.optedOut) {
      row.classList.add("is-opted-out");
    } else if (isCurrent) {
      row.classList.add("is-active-turn");
    }

    let statusText = "Esperando";
    if (p.optedOut) {
      statusText = "No toma más ❌";
    } else if (isCurrent) {
      statusText =
        AppState.activeSession.state === "DRINKING"
          ? "Tomando mate 🧉"
          : "Le toca ahora";
    } else if (!isEligibleThisRound) {
      statusText = "Saltea esta vuelta ⏭";
    }

    row.innerHTML = `
            <div class="roster-row-info">
                <span class="roster-mate-count">${p.matesTaken} 🧉</span>
                <div>
                    <span class="roster-name">${p.name} ${p.isCebador ? "<small>(Cebador 🧉)</small>" : ""}</span>
                    <span class="roster-status-pill">${statusText}</span>
                </div>
            </div>
            ${!p.optedOut ? `<button type="button" class="btn-red-drop" data-id="${idx}">No quiero más</button>` : ""}
        `;

    const optOutBtn = row.querySelector(".btn-red-drop");
    if (optOutBtn) {
      optOutBtn.addEventListener("click", () => {
        handleParticipantOptOut(idx);
      });
    }

    rosterList.appendChild(row);
  });
}

// ---------------- ACCIONES: ENTREGAR Y RECIBIR MATE ----------------
function handleMateDelivered() {
  const drinker = getCurrentDrinker();
  if (!drinker) return;

  window.mateAudio.playDelivered();
  AppState.activeSession.state = "DRINKING";

  startHoldingTimer();
  renderActiveCebadaScreen();
}

function handleMateReceived() {
  const drinker = getCurrentDrinker();
  if (!drinker) return;

  stopActiveTimer();
  window.mateAudio.stopAlarm();
  window.mateAudio.playReceived();

  drinker.matesTaken++;
  AppState.activeSession.totalMates++;

  // Descontar agua del termo si tiene capacidad limitada
  const { termoCapacity } = AppState.currentGroup;
  if (termoCapacity > 0) {
    if (AppState.activeSession.termoMatesLeft > 0) {
      AppState.activeSession.termoMatesLeft--;
    }
    updateTermoDisplay();

    if (AppState.activeSession.termoMatesLeft === 0) {
      showToast(
        "⚠️ ¡Se terminó el agua del termo! Toca 'Recargar' para rellenar.",
      );
    }
  }

  showToast(`Mate de ${drinker.name} completado ✅`);
  advanceToNextTurn();
}

function advanceToNextTurn() {
  AppState.activeSession.state = "READY_TO_DELIVER";
  AppState.activeSession.currentTurnIndex++;

  if (
    AppState.activeSession.currentTurnIndex >=
    AppState.activeSession.roundOrder.length
  ) {
    advanceToNextRound();
  } else {
    renderActiveCebadaScreen();
  }
}

function advanceToNextRound() {
  AppState.activeSession.roundNumber++;
  AppState.activeSession.state = "READY_TO_DELIVER";
  prepareRoundOrder();

  const activeParticipants = AppState.currentGroup.participants.filter(
    (p) => !p.optedOut,
  );
  if (activeParticipants.length === 0) {
    confirmFinishMateada();
    return;
  }

  showToast(`✨ ¡Comenzó la Ronda #${AppState.activeSession.roundNumber}!`);
  renderActiveCebadaScreen();
}

// ---------------- BOTÓN ROJO: NO QUIERO MÁS ----------------
function handleParticipantOptOut(participantIndex) {
  const p = AppState.currentGroup.participants[participantIndex];
  if (!p) return;

  if (confirm(`¿${p.name} no tomará más mates por el resto de la mateada?`)) {
    p.optedOut = true;
    window.mateAudio.playOptOut();
    showToast(`❌ ${p.name} dijo "¡No quiero más!" y fue descartado.`);

    const currentDrinker = getCurrentDrinker();
    if (currentDrinker && currentDrinker.id === p.id) {
      stopActiveTimer();
      window.mateAudio.stopAlarm();
      advanceToNextTurn();
    } else {
      AppState.activeSession.roundOrder =
        AppState.activeSession.roundOrder.filter(
          (idx) => idx !== participantIndex,
        );
      renderActiveCebadaScreen();
    }
  }
}

// ---------------- CRONÓMETRO Y ALARMA ----------------
function startHoldingTimer() {
  stopActiveTimer();
  const totalTime = AppState.currentGroup.holdingTimeSeconds;
  AppState.activeSession.timerRemaining = totalTime;

  updateTimerDisplay(totalTime, totalTime);

  const timerContainer = document.getElementById("timer-container");
  timerContainer.classList.remove("alarm-active");

  AppState.activeSession.timerInterval = setInterval(() => {
    AppState.activeSession.timerRemaining--;
    const remaining = AppState.activeSession.timerRemaining;

    updateTimerDisplay(remaining, totalTime);

    if (remaining <= 0) {
      clearInterval(AppState.activeSession.timerInterval);
      AppState.activeSession.timerInterval = null;
      triggerAlarm();
    }
  }, 1000);
}

function stopActiveTimer() {
  if (AppState.activeSession.timerInterval) {
    clearInterval(AppState.activeSession.timerInterval);
    AppState.activeSession.timerInterval = null;
  }
  const timerContainer = document.getElementById("timer-container");
  if (timerContainer) {
    timerContainer.classList.remove("alarm-active");
  }
}

function triggerAlarm() {
  const drinker = getCurrentDrinker();
  const timerContainer = document.getElementById("timer-container");
  if (timerContainer) {
    timerContainer.classList.add("alarm-active");
  }
  window.mateAudio.startAlarm();
  const warningText =
    drinker && drinker.isCebador
      ? "⏰ ¡Alarma! ¡Cebador, te estás durmiendo con el mate!"
      : `⏰ ¡Alarma! ${drinker ? drinker.name : "Alguien"} se durmió con el mate`;
  showToast(warningText);
}

function resetTimerDisplay() {
  stopActiveTimer();
  window.mateAudio.stopAlarm();
  const totalTime = AppState.currentGroup.holdingTimeSeconds;
  updateTimerDisplay(totalTime, totalTime);
}

function updateTimerDisplay(remaining, total) {
  const mins = Math.floor(Math.max(0, remaining) / 60);
  const secs = Math.max(0, remaining) % 60;
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const digitsEl = document.getElementById("timer-digits");
  if (digitsEl) digitsEl.textContent = formatted;

  const fillEl = document.getElementById("timer-progress-fill");
  if (fillEl && total > 0) {
    const percent = Math.max(0, Math.min(100, (remaining / total) * 100));
    fillEl.style.width = `${percent}%`;

    fillEl.classList.remove("warning", "danger");
    if (percent <= 25) {
      fillEl.classList.add("danger");
    } else if (percent <= 50) {
      fillEl.classList.add("warning");
    }
  }
}

// ---------------- FINALIZAR MATEADA Y RESUMEN ----------------
function confirmFinishMateada() {
  stopActiveTimer();
  window.mateAudio.stopAlarm();

  const { totalMates, roundNumber, startTime, termoRefillCount } =
    AppState.activeSession;
  const durationSeconds = startTime
    ? Math.round((new Date() - startTime) / 1000)
    : 0;
  const durationMins = Math.round(durationSeconds / 60);

  const cebador = AppState.currentGroup.participants.find((p) => p.isCebador);
  const cebadorName = cebador ? cebador.name : "Cebador";

  fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      group_name: AppState.currentGroup.name,
      cebador_name: cebadorName,
      total_rounds: roundNumber,
      total_mates: totalMates,
      duration_seconds: durationSeconds,
      participants_data: AppState.currentGroup.participants,
    }),
  }).catch((err) => console.error("Error al registrar historial:", err));

  document.getElementById("summary-total-mates").textContent = totalMates;
  document.getElementById("summary-total-rounds").textContent = roundNumber;
  document.getElementById("summary-duration").textContent =
    `${durationMins} min`;

  const rankingContainer = document.getElementById("summary-ranking-list");
  rankingContainer.innerHTML = "";

  const sorted = [...AppState.currentGroup.participants].sort(
    (a, b) => b.matesTaken - a.matesTaken,
  );
  sorted.forEach((p, idx) => {
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.padding = "8px 0";
    item.style.borderBottom = "1px solid #e0e0e0";
    item.innerHTML = `
            <span><strong>#${idx + 1}</strong> ${p.name} ${p.isCebador ? "(Cebador 🧉)" : ""} ${p.optedOut ? "<small>(se bajó)</small>" : ""}</span>
            <span style="font-weight: bold; color: var(--green-apple);">${p.matesTaken} mates</span>
        `;
    rankingContainer.appendChild(item);
  });

  if (termoRefillCount > 0) {
    const refillNote = document.createElement("div");
    refillNote.style.fontSize = "0.85rem";
    refillNote.style.color = "var(--text-muted)";
    refillNote.style.marginTop = "8px";
    refillNote.textContent = `🫖 Termos recargados durante la sesión: ${termoRefillCount}`;
    rankingContainer.appendChild(refillNote);
  }

  AppState.activeSession.isActive = false;
  document.getElementById("modal-summary").classList.add("active");
}

// ---------------- MODAL DE RONDAS GUARDADAS ----------------
function openSavedGroupsModal() {
  const listContainer = document.getElementById("saved-groups-list");
  listContainer.innerHTML = "";

  if (AppState.savedGroups.length === 0) {
    listContainer.innerHTML = `<p style="color: var(--text-muted); padding: 12px 0;">No tienes grupos guardados todavía. Crea uno en "Nueva Ronda" y márcalo para guardar.</p>`;
  } else {
    AppState.savedGroups.forEach((group) => {
      const card = document.createElement("div");
      card.style.background = "var(--bg-aqua-light)";
      card.style.border = "1px solid var(--border-soft)";
      card.style.borderRadius = "var(--radius-md)";
      card.style.padding = "14px";
      card.style.marginBottom = "10px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";

      const memberNames = (group.members || []).map((m) => m.name).join(", ");

      card.innerHTML = `
                <div>
                    <h4 style="font-weight: 800; color: var(--green-dark); margin-bottom: 4px;">${group.group_name}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${group.members ? group.members.length : 0} integrantes: ${memberNames}</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-apple" style="padding: 8px 14px; font-size: 0.85rem; width: auto;" data-action="load" data-id="${group.id}">Cargar</button>
                    <button type="button" class="btn-remove-person" style="font-size: 1.1rem;" data-action="delete" data-id="${group.id}" title="Eliminar grupo">🗑</button>
                </div>
            `;

      card
        .querySelector('[data-action="load"]')
        .addEventListener("click", () => {
          loadGroupIntoConfig(group);
          document
            .getElementById("modal-saved-groups")
            .classList.remove("active");
          showScreen("screen-config");
        });

      card
        .querySelector('[data-action="delete"]')
        .addEventListener("click", async () => {
          if (confirm(`¿Eliminar el grupo "${group.group_name}"?`)) {
            await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
            await loadSavedGroups();
            openSavedGroupsModal();
          }
        });

      listContainer.appendChild(card);
    });
  }

  document.getElementById("modal-saved-groups").classList.add("active");
}

function loadGroupIntoConfig(group) {
  document.getElementById("config-group-name").value = group.group_name;
  document.getElementById("config-save-checkbox").checked = false;
  document.getElementById("config-alarm-time").value = "1";
  document.getElementById("config-delivery-mode").value = "circle";

  const container = document.getElementById("participants-container");
  container.innerHTML = "";

  if (group.members && group.members.length > 0) {
    group.members.forEach((m) => {
      addParticipantRow(m.name, m.is_cebador === 1, m.frequency || 1);
    });
  } else {
    addParticipantRow("Cebador", true, 1);
    addParticipantRow("Amigo", false, 1);
  }
}

// ---------------- UTILIDAD: NOTIFICACIÓN TOAST ----------------
function showToast(message) {
  const toast = document.getElementById("toast-notice");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}
