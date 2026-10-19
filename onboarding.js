const guideSteps = Array.from(document.querySelectorAll(".onboarding-step"));
const guideDots = document.getElementById("onboardingDots");
const guideProgress = document.getElementById("onboardingProgressFill");
const guideBack = document.getElementById("onboardingBack");
const guideNext = document.getElementById("onboardingNext");
let currentGuideStep = 0;

function showGuideStep(step) {
    currentGuideStep = Math.max(0, Math.min(step, guideSteps.length - 1));
    guideSteps.forEach((panel, index) => {
        const active = index === currentGuideStep;
        panel.classList.toggle("is-active", active);
        panel.setAttribute("aria-hidden", String(!active));
    });
    if (guideProgress) guideProgress.style.width = `${((currentGuideStep + 1) / guideSteps.length) * 100}%`;
    if (guideBack) guideBack.disabled = currentGuideStep === 0;
    if (guideNext) {
        guideNext.innerHTML = currentGuideStep === guideSteps.length - 1
            ? "Let’s get started <span aria-hidden=\"true\">✓</span>"
            : "Continue <span aria-hidden=\"true\">→</span>";
    }
    guideDots?.querySelectorAll("button").forEach((dot, index) => {
        if (index === currentGuideStep) dot.setAttribute("aria-current", "step");
        else dot.removeAttribute("aria-current");
    });
}

guideSteps.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to guide page ${index + 1}`);
    dot.addEventListener("click", () => showGuideStep(index));
    guideDots?.append(dot);
});

guideBack?.addEventListener("click", () => showGuideStep(currentGuideStep - 1));
guideNext?.addEventListener("click", () => {
    if (currentGuideStep === guideSteps.length - 1) {
        document.getElementById("dismissOnboarding")?.click();
        return;
    }
    showGuideStep(currentGuideStep + 1);
});

document.getElementById("onboardingButton")?.addEventListener("click", () => showGuideStep(0));
document.getElementById("dismissOnboarding")?.addEventListener("click", () => showGuideStep(0));
showGuideStep(0);
