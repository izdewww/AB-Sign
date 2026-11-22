import { Icon } from './icons';

interface SignSuccessModalProps {
  signName: string;
  onNextSign: () => void;
  onPracticeAgain: () => void;
  onDismiss: () => void;
}

export function SignSuccessModal({
  signName,
  onNextSign,
  onPracticeAgain,
  onDismiss,
}: SignSuccessModalProps) {
  return (
    <div className="sign-success-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
      <div className="sign-success-modal-card paper">
        {/* Dismiss Button */}
        <button
          type="button"
          className="modal-dismiss-btn"
          aria-label="Dismiss modal"
          onClick={onDismiss}
        >
          <Icon name="close" />
        </button>

        {/* Celebratory Emblem */}
        <div className="celebratory-emblem-wrap">
          <div className="celebratory-circle-green">
            <Icon name="check" />
          </div>
          <div className="gold-star-badge" aria-hidden="true">
            ⭐
          </div>
        </div>

        {/* SPED-Friendly Headline & Copy */}
        <div className="modal-copy-section">
          <h2 id="success-modal-title" className="modal-headline">
            Great Sign!
          </h2>
          <p className="modal-subline">
            You signed <strong>{signName}</strong> correctly.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions-row">
          <button
            type="button"
            className="button primary next-sign-btn"
            onClick={onNextSign}
          >
            <span>NEXT SIGN</span>
            <Icon name="arrow" />
          </button>

          <button
            type="button"
            className="button secondary practice-again-btn"
            onClick={onPracticeAgain}
          >
            <Icon name="retry" />
            <span>PRACTICE AGAIN</span>
          </button>
        </div>
      </div>
    </div>
  );
}
