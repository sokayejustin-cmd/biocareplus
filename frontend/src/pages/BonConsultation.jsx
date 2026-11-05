function BonConsultation() {
  return (
    <div style={{ padding: "30px" }}>
      <h1>Bon de consultation</h1>
      <p>Le composant fonctionne correctement.</p>

      <button
        className="btn"
        type="button"
        onClick={() => window.print()}
      >
        Imprimer le bon
      </button>
    </div>
  );
}

export default BonConsultation;