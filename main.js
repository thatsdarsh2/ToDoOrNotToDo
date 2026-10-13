const STORAGE_KEY = 'fluidTaskManager_state';
const ONBOARDING_KEY = 'fluidTaskManager_onboarding_complete';
const SIDEBAR_KEY = 'fluidTaskManager_sidebar_collapsed';
const DEFAULT_SETTINGS = {
    pageColor: '#111827',
    bubbleColor: '#f5bd77',
    blur: 12,
    glass: 18,
    pixel: false,
};

let currentWaterLevel = 5;
let completedToday = 0;
let completionDate = new Date().toDateString();
let activeBubbleElement = null;
let calendarWeekOffset = 0;
let timerMode = 'work';
let timerRemaining = 25 * 60;
let timerEndsAt = null;
let timerInterval = null;
let notifiedReminders = new Set();

const sandbox = document.getElementById('sandbox');
const taskTitle = document.getElementById('taskTitle');
const taskDesc = document.getElementById('taskDesc');
const taskDue = document.getElementById('taskDue');
const taskPriority = document.getElementById('taskPriority');
const taskCategory = document.getElementById('taskCategory');
const taskRepeat = document.getElementById('taskRepeat');
const taskReminder = document.getElementById('taskReminder');
const btnShoot = document.getElementById('btnShoot');
const waterBg = document.getElementById('waterBg');
const taskCount = document.getElementById('taskCount');
const boardHint = document.getElementById('boardHint');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalDetails = document.getElementById('modalDetails');
const btnComplete = document.getElementById('btnComplete');
const btnClose = document.getElementById('btnClose');
const btnFocusTask = document.getElementById('btnFocusTask');
const pageColor = document.getElementById('pageColor');
const bubbleColor = document.getElementById('bubbleColor');
const blurStrength = document.getElementById('blurStrength');
const blurValue = document.getElementById('blurValue');
const glassStrength = document.getElementById('glassStrength');
const glassValue = document.getElementById('glassValue');
const pixelEffect = document.getElementById('pixelEffect');
const resetStyle = document.getElementById('resetStyle');
const calendarView = document.getElementById('calendarView');
const boardHeading = document.querySelector('.board-heading');
const calendarDays = document.getElementById('calendarDays');
const calendarRange = document.getElementById('calendarRange');
const timerDisplay = document.getElementById('timerDisplay');
const timerStart = document.getElementById('timerStart');
const focusTaskLabel = document.getElementById('focusTaskLabel');
const focusToggle = document.getElementById('focusToggle');
const notificationStatus = document.getElementById('notificationStatus');
const enableNotifications = document.getElementById('enableNotifications');
const onboardingOverlay = document.getElementById('onboardingOverlay');
const dueTodayCount = document.getElementById('dueTodayCount');
const highPriorityCount = document.getElementById('highPriorityCount');
const progressPercent = document.getElementById('progressPercent');
const progressRingValue = document.getElementById('progressRingValue');
const boardSummary = document.getElementById('boardSummary');
const achievementToast = document.getElementById('achievementToast');
const achievementMessage = document.getElementById('achievementMessage');
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const boardDateLabel = document.getElementById('boardDateLabel');
let toastTimeout = null;

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

function getTasks() {
    return Array.from(sandbox.querySelectorAll('.bubble:not(.popping)'));
}

function updateTaskCount() {
    const tasks = getTasks();
    const count = tasks.length;
    const today = new Date().toDateString();
    if (completionDate !== today) {
        completionDate = today;
        completedToday = 0;
    }
    const dueToday = tasks.filter((task) => task.dataset.dueAt && new Date(task.dataset.dueAt).toDateString() === today).length;
    const highPriority = tasks.filter((task) => task.dataset.priority === 'high').length;
    taskCount.textContent = String(count);
    dueTodayCount.textContent = String(dueToday);
    highPriorityCount.textContent = String(highPriority);
    const totalToday = dueToday + completedToday;
    const progress = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;
    progressPercent.textContent = `${progress}%`;
    progressRingValue.style.strokeDashoffset = String(113.1 - (113.1 * progress / 100));
    const taskLabel = count === 1 ? 'task' : 'tasks';
    boardSummary.textContent = count
        ? `${count} ${taskLabel} in play · ${completedToday} completed today`
        : 'A clear space for the things that matter.';
    boardDateLabel.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(new Date()).toUpperCase();
    boardHint.classList.toggle('is-hidden', count > 0);
}

function serializeTask(bubble) {
    return {
        id: bubble.dataset.id,
        title: bubble.dataset.title,
        description: bubble.dataset.description,
        color: bubble.dataset.color,
        blur: bubble.dataset.blur,
        glass: bubble.dataset.glass,
        left: bubble.style.getPropertyValue('--bubble-x') || bubble.style.left,
        bottom: bubble.style.getPropertyValue('--bubble-y') || bubble.style.bottom,
        dueAt: bubble.dataset.dueAt || '',
        priority: bubble.dataset.priority || 'normal',
        category: bubble.dataset.category || '',
        recurrence: bubble.dataset.recurrence || 'none',
        reminder: bubble.dataset.reminder || 'none',
        createdAt: bubble.dataset.createdAt || new Date().toISOString(),
    };
}

function saveStateToLocalStorage() {
    const tasks = getTasks().map(serializeTask);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        waterLevel: currentWaterLevel,
        completedToday,
        completionDate,
        settings: getSettings(),
        tasks,
        notifiedReminders: Array.from(notifiedReminders).slice(-300),
        timer: { mode: timerMode, remaining: timerRemaining, endsAt: timerEndsAt },
    }));
}

function formatDateTime(value) {
    if (!value) return 'No date set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date set';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function recurrenceLabel(recurrence) {
    return ({
        daily: 'Every day',
        weekdays: 'Weekdays',
        weekly: 'Every week',
        monthly: 'Every month',
    })[recurrence] || 'No repeat';
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
    const metadata = document.createElement('span');
    const priority = document.createElement('span');
    const category = document.createElement('span');
    const due = document.createElement('span');

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
    metadata.className = 'bubble-metadata';
    priority.className = `task-priority priority-${['low', 'normal', 'high'].includes(taskData.priority) ? taskData.priority : 'normal'}`;
    priority.textContent = `${['low', 'normal', 'high'].includes(taskData.priority) ? taskData.priority : 'normal'} priority`;
    category.className = 'task-category';
    category.textContent = String(taskData.category || '').slice(0, 32);
    due.className = 'task-due';
    due.textContent = taskData.dueAt ? formatDateTime(taskData.dueAt) : recurrenceLabel(taskData.recurrence) !== 'No repeat' ? recurrenceLabel(taskData.recurrence) : 'No due date';
    content.append(heading, note);
    metadata.append(priority);
    if (category.textContent) metadata.append(category);
    metadata.append(due);
    content.append(metadata);
    bubble.append(content);

    bubble.dataset.id = taskData.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    bubble.dataset.title = title;
    bubble.dataset.description = description;
    bubble.dataset.color = safeColor;
    bubble.dataset.blur = String(safeBlur);
    bubble.dataset.glass = String(safeGlass);
    bubble.dataset.dueAt = typeof taskData.dueAt === 'string' ? taskData.dueAt : '';
    bubble.dataset.priority = ['low', 'normal', 'high'].includes(taskData.priority) ? taskData.priority : 'normal';
    bubble.dataset.category = String(taskData.category || '').slice(0, 32);
    bubble.dataset.recurrence = ['daily', 'weekdays', 'weekly', 'monthly'].includes(taskData.recurrence) ? taskData.recurrence : 'none';
    bubble.dataset.reminder = ['due', '10', '30'].includes(taskData.reminder) ? taskData.reminder : 'none';
    bubble.dataset.createdAt = taskData.createdAt || new Date().toISOString();
    bubble.setAttribute('aria-label', [
        `Open task: ${title}`,
        `${bubble.dataset.priority} priority`,
        bubble.dataset.category,
        due.textContent,
        recurrenceLabel(bubble.dataset.recurrence),
    ].filter(Boolean).join('. '));

    sandbox.append(bubble);
    if (triggerShootEffect) {
        bubble.classList.add('is-entering');
        requestAnimationFrame(() => bubble.classList.add('active'));
        bubble.addEventListener('animationend', () => bubble.classList.remove('is-entering'), { once: true });
    } else {
        bubble.classList.add('active');
    }

    bubble.addEventListener('click', () => openTask(bubble));
    updateTaskCount();
    return bubble;
}

function openTask(bubble) {
    activeBubbleElement = bubble;
    modalTitle.textContent = bubble.dataset.title;
    modalDesc.textContent = bubble.dataset.description;
    const details = [
        formatDateTime(bubble.dataset.dueAt),
        `${bubble.dataset.priority[0].toUpperCase()}${bubble.dataset.priority.slice(1)} priority`,
        bubble.dataset.category || '',
        recurrenceLabel(bubble.dataset.recurrence),
        bubble.dataset.reminder === 'none' ? '' : `Reminder: ${bubble.dataset.reminder === 'due' ? 'at due time' : `${bubble.dataset.reminder} minutes before`}`,
    ].filter(Boolean);
    modalDetails.textContent = details.join(' · ');
    modalOverlay.classList.add('active');
    modalOverlay.setAttribute('aria-hidden', 'false');
    btnComplete.focus();
}

function createAndShootBubble(overrides = {}) {
    const title = (overrides.title || taskTitle.value).trim();
    const description = (overrides.description || taskDesc.value).trim();
    if (!title) {
        taskTitle.setCustomValidity('Enter a task title to add it to your board.');
        taskTitle.reportValidity();
        taskTitle.addEventListener('input', () => taskTitle.setCustomValidity(''), { once: true });
        return null;
    }

    const currentSettings = getSettings();
    const newTask = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        description: description || 'No description added',
        color: currentSettings.bubbleColor,
        blur: currentSettings.blur,
        glass: currentSettings.glass,
        left: '',
        bottom: '',
        dueAt: overrides.dueAt ?? taskDue.value,
        priority: overrides.priority || taskPriority.value,
        category: overrides.category ?? taskCategory.value.trim(),
        recurrence: overrides.recurrence || taskRepeat.value,
        reminder: overrides.reminder || taskReminder.value,
        createdAt: new Date().toISOString(),
    };

    const bubble = renderBubbleElement(newTask, true);
    taskTitle.value = '';
    taskDesc.value = '';
    taskDue.value = '';
    taskPriority.value = 'normal';
    taskCategory.value = '';
    taskRepeat.value = 'none';
    taskReminder.value = 'none';
    saveStateToLocalStorage();
    showAchievement('Task added to your board');
    renderCalendar();
    taskTitle.focus();
    return bubble;
}

function closeModal(restoreFocus = true) {
    modalOverlay.classList.remove('active');
    modalOverlay.setAttribute('aria-hidden', 'true');
    const previousBubble = activeBubbleElement;
    activeBubbleElement = null;
    if (restoreFocus && previousBubble?.isConnected) previousBubble.focus();
}

function advanceRecurringDate(value, recurrence) {
    let date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) date = new Date();
    const now = new Date();
    if (date < now) date = now;

    if (recurrence === 'daily') date.setDate(date.getDate() + 1);
    if (recurrence === 'weekdays') {
        do {
            date.setDate(date.getDate() + 1);
        } while (date.getDay() === 0 || date.getDay() === 6);
    }
    if (recurrence === 'weekly') date.setDate(date.getDate() + 7);
    if (recurrence === 'monthly') {
        const day = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(day, lastDay));
    }
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function executeTaskCompletion() {
    const completedBubble = activeBubbleElement;
    if (!completedBubble || completedBubble.classList.contains('popping')) return;

    const repeat = completedBubble.dataset.recurrence;
    const nextTask = repeat !== 'none' ? {
        ...serializeTask(completedBubble),
        dueAt: advanceRecurringDate(completedBubble.dataset.dueAt, repeat),
        left: completedBubble.style.getPropertyValue('--bubble-x'),
        bottom: completedBubble.style.getPropertyValue('--bubble-y'),
    } : null;

    closeModal(false);
    completedBubble.classList.add('popping');
    completedToday += 1;
    updateTaskCount();

    window.setTimeout(() => {
        completedBubble.remove();
        if (nextTask) renderBubbleElement(nextTask, true);
        currentWaterLevel = Math.min(95, currentWaterLevel + 12);
        waterBg.style.height = `${currentWaterLevel}%`;
        updateTaskCount();
        saveStateToLocalStorage();
        renderCalendar();
        showAchievement(repeat === 'none' ? 'Task complete — nice work!' : 'Task complete — your next one is ready!');
    }, 380);
}

function addDailyRoutine() {
    const routine = [
        { title: 'Plan your day', description: 'Choose one thing that matters most today.', hour: 9 },
        { title: 'Take a mindful break', description: 'Step away from your screen and reset.', hour: 13 },
        { title: 'Review your day', description: 'Celebrate a win and prepare for tomorrow.', hour: 18 },
    ];
    let added = 0;
    routine.forEach((item) => {
        const exists = getTasks().some((bubble) => bubble.dataset.title === item.title && bubble.dataset.recurrence === 'daily');
        if (exists) return;
        const date = new Date();
        date.setHours(item.hour, 0, 0, 0);
        if (date < new Date()) date.setDate(date.getDate() + 1);
        const pad = (number) => String(number).padStart(2, '0');
        const dueAt = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        createAndShootBubble({
            title: item.title,
            description: item.description,
            dueAt,
            recurrence: 'daily',
            priority: 'normal',
            category: 'Routine',
            reminder: '10',
        });
        added += 1;
    });
    if (added === 0) notificationStatus.textContent = 'Your everyday routine is already on the board.';
    renderCalendar();
    return added;
}

function localDateKey(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function renderCalendar() {
    if (!calendarDays) return;
    calendarDays.replaceChildren();
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekdayOffset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - weekdayOffset + (calendarWeekOffset * 7));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const rangeFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    calendarRange.textContent = `${rangeFormat.format(monday)} – ${rangeFormat.format(sunday)}`;

    const tasks = getTasks();
    for (let index = 0; index < 7; index += 1) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        const day = document.createElement('section');
        day.className = `calendar-day${localDateKey(date) === localDateKey(today) ? ' is-today' : ''}`;
        const heading = document.createElement('h3');
        heading.className = 'calendar-day-heading';
        heading.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
        day.append(heading);
        const dayTasks = tasks
            .filter((task) => task.dataset.dueAt && localDateKey(new Date(task.dataset.dueAt)) === localDateKey(date))
            .sort((first, second) => new Date(first.dataset.dueAt) - new Date(second.dataset.dueAt));
        if (dayTasks.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'calendar-empty';
            empty.textContent = 'Nothing planned';
            day.append(empty);
        }
        dayTasks.forEach((task) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `calendar-task priority-${task.dataset.priority}`;
            const time = document.createElement('span');
            time.className = 'calendar-task-time';
            time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(task.dataset.dueAt));
            const title = document.createElement('span');
            title.className = 'calendar-task-title';
            title.textContent = task.dataset.title;
            item.append(time, title);
            item.addEventListener('click', () => openTask(task));
            day.append(item);
        });
        calendarDays.append(day);
    }
    const unscheduled = tasks.filter((task) => !task.dataset.dueAt);
    if (unscheduled.length) {
        const section = document.createElement('section');
        section.className = 'calendar-day calendar-unscheduled';
        const heading = document.createElement('h3');
        heading.className = 'calendar-day-heading';
        heading.textContent = 'Unscheduled';
        section.append(heading);
        unscheduled.forEach((task) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `calendar-task priority-${task.dataset.priority}`;
            item.textContent = task.dataset.title;
            item.addEventListener('click', () => openTask(task));
            section.append(item);
        });
        calendarDays.append(section);
    }
}

function setView(view) {
    const showCalendar = view === 'calendar';
    sandbox.classList.toggle('is-hidden', showCalendar);
    boardHeading.classList.toggle('is-hidden', showCalendar);
    calendarView.classList.toggle('is-hidden', !showCalendar);
    document.getElementById('boardViewButton').classList.toggle('active', !showCalendar);
    document.getElementById('boardViewButton').setAttribute('aria-pressed', String(!showCalendar));
    document.getElementById('calendarViewButton').classList.toggle('active', showCalendar);
    document.getElementById('calendarViewButton').setAttribute('aria-pressed', String(showCalendar));
    if (showCalendar) renderCalendar();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    timerStart.textContent = timerEndsAt ? 'Pause' : 'Start';
}

function setTimerMode(mode) {
    timerMode = mode;
    timerRemaining = mode === 'work' ? 25 * 60 : 5 * 60;
    timerEndsAt = null;
    window.clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('workMode').setAttribute('aria-pressed', String(mode === 'work'));
    document.getElementById('breakMode').setAttribute('aria-pressed', String(mode === 'break'));
    updateTimerDisplay();
    saveStateToLocalStorage();
}

function finishTimer() {
    window.clearInterval(timerInterval);
    timerInterval = null;
    timerEndsAt = null;
    timerRemaining = 0;
    updateTimerDisplay();
    notify('Focus session complete', timerMode === 'work' ? 'Nice work. Time for a short break.' : 'Break finished. Ready for another focus session?');
    notificationStatus.textContent = timerMode === 'work' ? 'Focus session complete — take a short break.' : 'Break finished — ready when you are.';
    saveStateToLocalStorage();
}

function startOrPauseTimer() {
    if (timerEndsAt) {
        timerRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
        timerEndsAt = null;
        window.clearInterval(timerInterval);
        timerInterval = null;
        updateTimerDisplay();
        saveStateToLocalStorage();
        return;
    }
    if (timerRemaining <= 0) timerRemaining = timerMode === 'work' ? 25 * 60 : 5 * 60;
    timerEndsAt = Date.now() + (timerRemaining * 1000);
    timerInterval = window.setInterval(() => {
        timerRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
        updateTimerDisplay();
        if (timerRemaining === 0) finishTimer();
    }, 250);
    updateTimerDisplay();
    saveStateToLocalStorage();
}

function restoreTimer(timer) {
    if (!timer || !['work', 'break'].includes(timer.mode)) {
        updateTimerDisplay();
        return;
    }
    timerMode = timer.mode;
    const modeDuration = timer.mode === 'work' ? 25 * 60 : 5 * 60;
    const savedRemaining = Number(timer.remaining);
    timerRemaining = Number.isFinite(savedRemaining) ? Math.max(0, Math.min(modeDuration, savedRemaining)) : modeDuration;
    document.getElementById('workMode').setAttribute('aria-pressed', String(timerMode === 'work'));
    document.getElementById('breakMode').setAttribute('aria-pressed', String(timerMode === 'break'));
    if (Number.isFinite(timer.endsAt) && timer.endsAt > Date.now()) {
        timerEndsAt = timer.endsAt;
        timerInterval = window.setInterval(() => {
            timerRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
            updateTimerDisplay();
            if (timerRemaining === 0) finishTimer();
        }, 250);
        updateTimerDisplay();
    } else {
        timerEndsAt = null;
        if (Number.isFinite(timer.endsAt) && timer.endsAt <= Date.now()) timerRemaining = 0;
        updateTimerDisplay();
    }
}

function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const notification = new Notification(title, { body, tag: title });
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

async function requestNotifications() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'This browser does not support desktop notifications.';
        return;
    }
    if (!window.isSecureContext) {
        notificationStatus.textContent = 'Browser reminders need HTTPS or localhost.';
        return;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            notificationStatus.textContent = 'Browser reminders are on while this page is open.';
            notify('Reminders enabled', 'You will be notified about scheduled tasks while Task Arcade is open.');
        } else {
            notificationStatus.textContent = 'Notifications are blocked. Change this site’s permission in your browser settings.';
        }
    } catch (error) {
        console.error('Failed to request browser notification permission:', error);
        notificationStatus.textContent = 'Could not request notification permission. Check your browser settings.';
    }
}

function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    getTasks().forEach((task) => {
        const due = new Date(task.dataset.dueAt).getTime();
        const reminder = task.dataset.reminder;
        if (!Number.isFinite(due) || reminder === 'none') return;
        const lead = reminder === 'due' ? 0 : Number(reminder) * 60 * 1000;
        const key = `${task.dataset.id}:${task.dataset.dueAt}:${reminder}`;
        if (now >= due - lead && now <= due + (2 * 60 * 1000) && !notifiedReminders.has(key)) {
            notifiedReminders.add(key);
            notify(task.dataset.title, reminder === 'due' ? 'This task is due now.' : `This task is due in ${reminder} minutes.`);
            saveStateToLocalStorage();
        }
    });
}

function focusNextTask() {
    const priority = { high: 0, normal: 1, low: 2 };
    const tasks = getTasks().sort((first, second) => {
        const priorityDiff = priority[first.dataset.priority] - priority[second.dataset.priority];
        if (priorityDiff) return priorityDiff;
        const firstDue = first.dataset.dueAt ? new Date(first.dataset.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const secondDue = second.dataset.dueAt ? new Date(second.dataset.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        return firstDue - secondDue;
    });
    if (!tasks.length) {
        notificationStatus.textContent = 'Add a task first and I’ll help you pick what to focus on.';
        taskTitle.focus();
        return;
    }
    focusTaskLabel.textContent = `Working on: ${tasks[0].dataset.title}`;
    if (timerMode !== 'work') setTimerMode('work');
    if (!timerEndsAt) startOrPauseTimer();
    document.body.classList.add('focus-mode');
    focusToggle.setAttribute('aria-pressed', 'true');
    focusToggle.textContent = 'Exit focus mode';
}

function toggleFocusMode() {
    const enabled = document.body.classList.toggle('focus-mode');
    focusToggle.setAttribute('aria-pressed', String(enabled));
    focusToggle.textContent = enabled ? 'Exit focus mode' : 'Enter focus mode';
}

function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onboardingOverlay.classList.remove('active');
    onboardingOverlay.setAttribute('aria-hidden', 'true');
}

function showAchievement(message) {
    achievementMessage.textContent = message;
    achievementToast.classList.remove('is-visible');
    void achievementToast.offsetWidth;
    achievementToast.classList.add('is-visible');
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => achievementToast.classList.remove('is-visible'), 2800);
}

function setSidebarCollapsed(collapsed) {
    sidebar.classList.toggle('is-collapsed', collapsed);
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
}

function showOnboarding() {
    if (localStorage.getItem(ONBOARDING_KEY) === 'true') return;
    onboardingOverlay.classList.add('active');
    onboardingOverlay.setAttribute('aria-hidden', 'false');
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
        const savedSettings = { ...(state.settings || {}) };
        if (savedSettings.pageColor === '#b84432' && savedSettings.bubbleColor === '#f4cda5') {
            savedSettings.pageColor = DEFAULT_SETTINGS.pageColor;
            savedSettings.bubbleColor = DEFAULT_SETTINGS.bubbleColor;
            savedSettings.pixel = false;
        }
        const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
        applySettings(settings);

        if (Number.isFinite(state.waterLevel)) {
            currentWaterLevel = Math.min(95, Math.max(5, state.waterLevel));
            waterBg.style.height = `${currentWaterLevel}%`;
        }
        if (state.completionDate === new Date().toDateString() && Number.isFinite(state.completedToday)) {
            completedToday = Math.max(0, state.completedToday);
        } else {
            completedToday = 0;
            completionDate = new Date().toDateString();
        }

        if (Array.isArray(state.tasks)) {
            state.tasks.forEach((task) => {
                if (task && typeof task === 'object') renderBubbleElement(task);
            });
        }
        if (Array.isArray(state.notifiedReminders)) notifiedReminders = new Set(state.notifiedReminders);
        restoreTimer(state.timer);
        updateTaskCount();
    } catch (error) {
        console.error('Failed to rehydrate local storage parameters:', error);
        applySettings(DEFAULT_SETTINGS);
        updateTaskCount();
    }
}

btnShoot.addEventListener('click', () => createAndShootBubble());
btnComplete.addEventListener('click', executeTaskCompletion);
btnClose.addEventListener('click', () => closeModal());
btnFocusTask.addEventListener('click', () => {
    if (activeBubbleElement) focusTaskLabel.textContent = `Working on: ${activeBubbleElement.dataset.title}`;
    closeModal(false);
    if (timerMode !== 'work') setTimerMode('work');
    if (!timerEndsAt) startOrPauseTimer();
    document.body.classList.add('focus-mode');
    focusToggle.setAttribute('aria-pressed', 'true');
    focusToggle.textContent = 'Exit focus mode';
});

modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
    if (event.key === 'Escape' && onboardingOverlay.classList.contains('active')) dismissOnboarding();
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
document.getElementById('boardViewButton').addEventListener('click', () => setView('board'));
document.getElementById('calendarViewButton').addEventListener('click', () => setView('calendar'));
document.getElementById('previousWeek').addEventListener('click', () => {
    calendarWeekOffset -= 1;
    renderCalendar();
});
document.getElementById('nextWeek').addEventListener('click', () => {
    calendarWeekOffset += 1;
    renderCalendar();
});
document.getElementById('todayWeek').addEventListener('click', () => {
    calendarWeekOffset = 0;
    renderCalendar();
});
timerStart.addEventListener('click', startOrPauseTimer);
document.getElementById('timerReset').addEventListener('click', () => setTimerMode(timerMode));
document.getElementById('workMode').addEventListener('click', () => setTimerMode('work'));
document.getElementById('breakMode').addEventListener('click', () => setTimerMode('break'));
focusToggle.addEventListener('click', toggleFocusMode);
document.getElementById('focusNextTask').addEventListener('click', focusNextTask);
document.getElementById('addDailyRoutine').addEventListener('click', addDailyRoutine);
enableNotifications.addEventListener('click', requestNotifications);
document.getElementById('onboardingButton').addEventListener('click', () => {
    onboardingOverlay.classList.add('active');
    onboardingOverlay.setAttribute('aria-hidden', 'false');
});
document.getElementById('dismissOnboarding').addEventListener('click', dismissOnboarding);
document.getElementById('addRoutineFromOnboarding').addEventListener('click', () => {
    addDailyRoutine();
    dismissOnboarding();
});

loadStateFromLocalStorage();
setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true');
if ('Notification' in window && Notification.permission === 'granted') {
    notificationStatus.textContent = 'Browser reminders are on while this page is open.';
} else if ('Notification' in window && Notification.permission === 'denied') {
    notificationStatus.textContent = 'Notifications are blocked in your browser settings.';
}
renderCalendar();
showOnboarding();
checkReminders();
window.setInterval(checkReminders, 30 * 1000);
sidebarToggle.addEventListener('click', () => setSidebarCollapsed(!sidebar.classList.contains('is-collapsed')));
document.getElementById('shortcutAdd').addEventListener('click', () => {
    setSidebarCollapsed(false);
    taskTitle.focus();
});
document.getElementById('shortcutCalendar').addEventListener('click', () => setView('calendar'));
document.getElementById('shortcutFocus').addEventListener('click', focusNextTask);
