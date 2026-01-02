import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicApi, type Product } from "../api/public";
import { useAuthStore } from "../store/auth.store";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const isMember = user?.role === "MEMBER";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    PublicApi.products()
      .then((data) => {
        if (mounted) setProducts(data);
      })
      .catch((e: any) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function handleCheckout(product: Product) {
    if (!isMember) {
      navigate("/register");
      return;
    }
    if (product.checkoutUrl) {
      window.open(product.checkoutUrl, "_blank", "noopener");
    } else {
      alert("Contacte ton coach pour finaliser le paiement de ce pack.");
    }
  }

  return (
    <div>
      <div className="shop-header">
        <h2>Offres & prestations</h2>
        <p>Choisis un accompagnement qui correspond à ton objectif.</p>
        <div className="shop-guard">
          {isMember ? (
            <span>Tes achats seront automatiquement liés à ton compte adhérent.</span>
          ) : (
            <>
              <span>Crée d&apos;abord ton compte adhérent pour activer l&apos;achat de packs.</span>
              <div className="hero-ctas" style={{ marginTop: 8, justifyContent: "center" }}>
                <Link to="/register" className="btn btn--outline">
                  Créer un compte
                </Link>
                <Link to="/login" className="btn btn--ghost">
                  Se connecter
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}
      {loading && <div>Chargement...</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {products.map((product) => (
          <div key={product.id} style={{ border: "1px solid #eee", padding: 18, borderRadius: 16, background: "white" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{product.title}</div>
            <div style={{ opacity: 0.7, marginTop: 8 }}>{product.description}</div>
            <div style={{ marginTop: 16, fontSize: 24 }}>{formatPrice(product.priceCents)}</div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#c1121f" }}>
              {product.creditValue ? `${product.creditValue}h incluses` : "Crédit non défini"}
            </div>
            <div style={{ opacity: 0.6, fontSize: 12 }}>{product.billingInterval === "MONTHLY" ? "Facturation mensuelle" : "Paiement unique"}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn--ghost btn--block" onClick={() => handleCheckout(product)} disabled={!isMember}>
                {isMember ? "Acheter ce pack" : "Créer mon compte"}
              </button>
            </div>
            <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Une fois le pack activé, réserve tes créneaux depuis ton dashboard adhérent.
            </p>
          </div>
        ))}
      </div>

      {!loading && products.length === 0 && !error && (
        <div style={{ marginTop: 16, opacity: 0.65 }}>Aucun produit n&apos;est disponible pour le moment.</div>
      )}
    </div>
  );
}
