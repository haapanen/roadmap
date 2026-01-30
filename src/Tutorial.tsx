import { useState, useEffect, useCallback } from "react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: "top" | "bottom" | "left" | "right";
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "text-input",
    title: "📝 Text Input",
    description:
      "Enter your roadmap data here using a simple text format. Define periods, teams, and tasks with intuitive syntax. You can also switch to the Visual editor tab for a form-based approach.",
    targetSelector: ".editor-section",
    position: "right",
  },
  {
    id: "visual-editor",
    title: "🎛️ Visual Editor",
    description:
      "Click the Visual tab to use a form-based editor. Add swimlanes, define time periods, and create items without writing any text syntax.",
    targetSelector: ".editor-tabs",
    position: "bottom",
  },
  {
    id: "preview",
    title: "👁️ Live Preview",
    description:
      "Your roadmap renders here in real-time as you type. The preview updates instantly with every change you make.",
    targetSelector: ".preview",
    position: "left",
  },
  {
    id: "drag-drop",
    title: "🖱️ Drag & Drop",
    description:
      "Drag items in the preview to reposition them! You can move items between swimlanes and adjust their timing by dragging. Resize items by dragging their edges.",
    targetSelector: ".svg-container",
    position: "left",
  },
  {
    id: "export-buttons",
    title: "📥 Export Options",
    description:
      "Copy your roadmap as PNG for presentations, download as SVG for editing, or export to draw.io format for further customization. You can also share via URL!",
    targetSelector: ".button-group",
    position: "bottom",
  },
];

const TUTORIAL_STORAGE_KEY = "roadmap-tutorial-completed";

interface TutorialProps {
  onComplete?: () => void;
}

export function Tutorial({ onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const step = TUTORIAL_STEPS[currentStep];

  const updateTargetRect = useCallback(() => {
    if (!step) return;
    const target = document.querySelector(step.targetSelector);
    if (target) {
      setTargetRect(target.getBoundingClientRect());
    }
  }, [step]);

  useEffect(() => {
    updateTargetRect();

    // Update on scroll/resize
    window.addEventListener("scroll", updateTargetRect, true);
    window.addEventListener("resize", updateTargetRect);

    return () => {
      window.removeEventListener("scroll", updateTargetRect, true);
      window.removeEventListener("resize", updateTargetRect);
    };
  }, [updateTargetRect]);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible || !step || !targetRect) {
    return null;
  }

  // Calculate tooltip position
  const padding = 12;
  const tooltipWidth = 320;
  const tooltipHeight = 200; // Approximate

  let tooltipStyle: React.CSSProperties = {
    position: "fixed",
    width: tooltipWidth,
    zIndex: 10001,
  };

  switch (step.position) {
    case "right":
      tooltipStyle.left = targetRect.right + padding;
      tooltipStyle.top =
        targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    case "left":
      tooltipStyle.left = targetRect.left - tooltipWidth - padding;
      tooltipStyle.top =
        targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    case "bottom":
      tooltipStyle.left =
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      tooltipStyle.top = targetRect.bottom + padding;
      break;
    case "top":
      tooltipStyle.left =
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      tooltipStyle.top = targetRect.top - tooltipHeight - padding;
      break;
  }

  // Keep tooltip on screen
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (tooltipStyle.left && typeof tooltipStyle.left === "number") {
    tooltipStyle.left = Math.max(
      padding,
      Math.min(tooltipStyle.left, viewportWidth - tooltipWidth - padding),
    );
  }
  if (tooltipStyle.top && typeof tooltipStyle.top === "number") {
    tooltipStyle.top = Math.max(
      padding,
      Math.min(tooltipStyle.top, viewportHeight - tooltipHeight - padding),
    );
  }

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div className="tutorial-overlay">
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <mask id="tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#tutorial-mask)"
          />
        </svg>

        {/* Highlight border around target */}
        <div
          className="tutorial-highlight"
          style={{
            position: "fixed",
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            borderRadius: 12,
            border: "3px solid #059669",
            boxShadow:
              "0 0 0 4px rgba(5, 150, 105, 0.3), 0 0 20px rgba(5, 150, 105, 0.4)",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        />
      </div>

      {/* Tooltip */}
      <div className="tutorial-tooltip" style={tooltipStyle}>
        <div className="tutorial-tooltip-header">
          <span className="tutorial-step-indicator">
            {currentStep + 1} / {TUTORIAL_STEPS.length}
          </span>
          <button className="tutorial-skip-btn" onClick={handleSkip}>
            Skip
          </button>
        </div>
        <h3 className="tutorial-tooltip-title">{step.title}</h3>
        <p className="tutorial-tooltip-description">{step.description}</p>
        <div className="tutorial-tooltip-actions">
          <button
            className="tutorial-btn tutorial-btn-secondary"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Previous
          </button>
          <button
            className="tutorial-btn tutorial-btn-primary"
            onClick={handleNext}
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Check if tutorial was completed before
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!completed) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => setShowTutorial(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  const endTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setShowTutorial(true);
  }, []);

  return {
    showTutorial,
    startTutorial,
    endTutorial,
    resetTutorial,
  };
}
