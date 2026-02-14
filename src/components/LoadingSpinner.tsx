import '../styles/components/_spinner.scss';

export function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Loading watchlists...</p>
    </div>
  );
}

