const STORAGE_KEY = 'fluidTaskManager_state';
const DEFAULT_SETTINGS = {
    pageColor: '#b84432',
    bubbleColor: '#f4cda5',
    blur: 12,
    glass: 18,
    pixel: true,
};

let currentWaterLevel = 5;
let activeBubbleElement = null;

const sandbox = document.getElementById('sandbox');
const taskTitle = document.getElementById('taskTitle');
const taskDesc = document.getElementById('taskDesc');
const btnShoot = document.getElementById('btnShoot');
const waterBg = document.getElementById('waterBg');
const taskCount = document.getElementById('taskCount');
const boardHint = document.getElementById('boardHint');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const btnComplete = document.getElementById('btnComplete');
const btnClose = document.getElementById('btnClose');
const pageColor = document.getElementById('pageColor');
const bubbleColor = document.getElementById('bubbleColor');
const blurStrength = document.getElementById('blurStrength');
const blurValue = document.getElementById('blurValue');
const glassStrength = document.getElementById('glassStrength');
const glassValue = document.getElementById('glassValue');
const pixelEffect = document.getElementById('pixelEffect');
const resetStyle = document.getElementById('resetStyle');

function hexToRgb(hex) {
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if (!match) return '244, 205, 165';
    return `${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}`;
}

function getSettings() {
    return {
        pageColor: pageColor.value,
        bubbleColor: bubbleColor.value,
        blur: Number(blurStrength.value),
        glass: Number(glassStrength.value),
        pixel: pixelEffect.checked,
    };
}

function applySettings(settings = getSettings()) {
    document.documentElement.style.setProperty('--board-color', settings.pageColor);
    document.documentElement.style.setProperty('--accent-color', settings.bubbleColor);
    document.documentElement.style.setProperty('--glass-opacity', settings.glass / 100);
    document.documentElement.style.setProperty('--glass-blur', `${settings.blur}px`);
    document.body.classList.toggle('pixel-off', !settings.pixel);

    pageColor.value = settings.pageColor;
    bubbleColor.value = settings.bubbleColor;
    blurStrength.value = String(settings.blur);
    glassStrength.value = String(settings.glass);
    pixelEffect.checked = settings.pixel;
    blurValue.value = `${settings.blur}px`;
    glassValue.value = `${settings.glass}%`;

    sandbox.querySelectorAll('.bubble').forEach((bubble) => {
        bubble.dataset.color = settings.bubbleColor;
        bubble.style.setProperty('--tint-rgb', hexToRgb(settings.bubbleColor));
        bubble.style.setProperty('--blur-weight', `${settings.blur}px`);
        bubble.style.setProperty('--glass-opacity', settings.glass / 100);
    });
}

function updateTaskCount() {
    const count = sandbox.querySelectorAll('.bubble:not(.popping)').length;
    taskCount.textContent = String(count);
    boardHint.classList.toggle('is-hidden', count > 0);
}

function saveStateToLocalStorage() {
    const tasks = Array.from(sandbox.querySelectorAll('.bubble:not(.popping)')).map((bubble) => ({
        id: bubble.dataset.id,
        title: bubble.dataset.title,
        description: bubble.dataset.description,
        color: bubble.dataset.color,
        blur: bubble.dataset.blur,
        glass: bubble.dataset.glass,
        left: bubble.style.getPropertyValue('--bubble-x') || bubble.style.left,
        bottom: bubble.style.getPropertyValue('--bubble-y') || bubble.style.bottom,
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        waterLevel: currentWaterLevel,
        settings: getSettings(),
        tasks,
    }));
}

function renderBubbleElement(taskData, triggerShootEffect = false) {
    const bubble = document.createElement('button');
    const safeColor = /^#[\da-f]{6}$/i.test(taskData.color || '') ? taskData.color : DEFAULT_SETTINGS.bubbleColor;
    const safeBlur = Math.min(24, Math.max(0, Number(taskData.blur) || DEFAULT_SETTINGS.blur));
    const safeGlass = Math.min(40, Math.max(8, Number(taskData.glass) || glassStrength.value));
    const title = String(taskData.title || 'Untitled task');
    const description = String(taskData.description || 'No description added');
    const content = document.createElement('span');
    const heading = document.createElement('span');
    const note = document.createElement('span');

    bubble.type = 'button';
    bubble.className = 'bubble';
    bubble.setAttribute('aria-label', `Open task: ${title}`);
    bubble.style.setProperty('--tint-rgb', hexToRgb(safeColor));
    bubble.style.setProperty('--blur-weight', `${safeBlur}px`);
    bubble.style.setProperty('--glass-opacity', safeGlass / 100);
    bubble.style.setProperty('--bubble-x', taskData.left || '8%');
    bubble.style.setProperty('--bubble-y', taskData.bottom || '18%');

    content.className = 'bubble-content';
    heading.className = 'bubble-title';
    heading.textContent = title;
    note.className = 'bubble-description';
    note.textContent = description;
    content.append(heading, note);
    bubble.append(content);

    bubble.dataset.id = taskData.id || Date.now().toString();
    bubble.dataset.title = title;
    bubble.dataset.description = description;
    bubble.dataset.color = safeColor;
    bubble.dataset.blur = String(safeBlur);
    bubble.dataset.glass = String(safeGlass);

    sandbox.append(bubble);
    if (triggerShootEffect) {
        requestAnimationFrame(() => bubble.classList.add('active'));
    } else {
        bubble.classList.add('active');
    }

    bubble.addEventListener('click', () => {
        activeBubbleElement = bubble;
        modalTitle.textContent = bubble.dataset.title;
        modalDesc.textContent = bubble.dataset.description;
        modalOverlay.classList.add('active');
        modalOverlay.setAttribute('aria-hidden', 'false');
        btnComplete.focus();
    });
    updateTaskCount();
}

function createAndShootBubble() {
    const title = taskTitle.value.trim();
    const description = taskDesc.value.trim();
    if (!title) {
        taskTitle.setCustomValidity('Enter a task title to add it to your board.');
        taskTitle.reportValidity();
        taskTitle.addEventListener('input', () => taskTitle.setCustomValidity(''), { once: true });
        return;
    }

    const currentSettings = getSettings();
    const newTask = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        description: description || 'No description added',
        color: currentSettings.bubbleColor,
        blur: currentSettings.blur,
        glass: currentSettings.glass,
        left: `${Math.floor(Math.random() * 68) + 5}%`,
        bottom: `${Math.floor(Math.random() * 50) + 12}%`,
    };

    renderBubbleElement(newTask, true);
    taskTitle.value = '';
    taskDesc.value = '';
    saveStateToLocalStorage();
    taskTitle.focus();
}

function closeModal(restoreFocus = true) {
    modalOverlay.classList.remove('active');
    modalOverlay.setAttribute('aria-hidden', 'true');
    const previousBubble = activeBubbleElement;
    activeBubbleElement = null;
    if (restoreFocus && previousBubble?.isConnected) previousBubble.focus();
}

function executeTaskCompletion() {
    const completedBubble = activeBubbleElement;
    if (!completedBubble || completedBubble.classList.contains('popping')) return;

    closeModal(false);
    completedBubble.classList.add('popping');
    updateTaskCount();

    window.setTimeout(() => {
        completedBubble.remove();
        currentWaterLevel = Math.min(95, currentWaterLevel + 12);
        waterBg.style.height = `${currentWaterLevel}%`;
        updateTaskCount();
        saveStateToLocalStorage();
    }, 220);
}

function loadStateFromLocalStorage() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) {
        applySettings(DEFAULT_SETTINGS);
        updateTaskCount();
        return;
    }

    try {
        const state = JSON.parse(savedData);
        const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
        applySettings(settings);

        if (Number.isFinite(state.waterLevel)) {
            currentWaterLevel = Math.min(95, Math.max(5, state.waterLevel));
            waterBg.style.height = `${currentWaterLevel}%`;
        }

        if (Array.isArray(state.tasks)) {
            state.tasks.forEach((task) => {
                if (task && typeof task === 'object') renderBubbleElement(task);
            });
        }
        updateTaskCount();
    } catch (error) {
        console.error('Failed to rehydrate local storage parameters:', error);
        applySettings(DEFAULT_SETTINGS);
        updateTaskCount();
    }
}

btnShoot.addEventListener('click', createAndShootBubble);
btnComplete.addEventListener('click', executeTaskCompletion);
btnClose.addEventListener('click', () => closeModal());

modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
});

[taskTitle, taskDesc].forEach((element) => {
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (element === taskTitle || !event.shiftKey)) {
            event.preventDefault();
            createAndShootBubble();
        }
    });
});

[pageColor, bubbleColor, blurStrength, glassStrength, pixelEffect].forEach((control) => {
    control.addEventListener('input', () => {
        applySettings();
        saveStateToLocalStorage();
    });
});

resetStyle.addEventListener('click', () => {
    applySettings(DEFAULT_SETTINGS);
    saveStateToLocalStorage();
});

loadStateFromLocalStorage();
