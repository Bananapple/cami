import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductPurchaseSheet from "@/components/ProductPurchaseSheet";
import { useProducts, type Product } from "@/hooks/useProducts";

const JoinNow = () => {
  const { products, isLoading, error } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const formatPrice = (p: Product) => {
    const symbol = p.currency === "NOK" ? "kr" : p.currency;
    const amount = (p.price_minor / 100).toLocaleString("nb-NO");
    const interval = p.billing_interval === "month" ? " / month" : "";
    return `${symbol} ${amount}${interval}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-4">Pricing</p>
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed mb-6">
          Memberships &amp; classes
        </h1>
        <p className="text-lg text-muted-foreground font-serif max-w-2xl mx-auto">
          Pick the option that suits your practice. Prices include VAT.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36">
        {error ? (
          <p className="text-center text-destructive font-sans py-8">
            Failed to load products. Please refresh.
          </p>
        ) : isLoading ? (
          <p className="text-center text-muted-foreground font-serif py-8">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {products.map((product) => (
              <div key={product.id} className="bg-card rounded-xl overflow-hidden flex flex-col">
                {product.image_url ? (
                  <div className="relative">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    {product.tag && (
                      <span className="absolute top-3 left-3 text-xs font-sans font-medium uppercase tracking-wider bg-background/90 text-foreground px-3 py-1.5 rounded-full">
                        {product.tag}
                      </span>
                    )}
                  </div>
                ) : product.tag ? (
                  <div className="px-6 pt-5">
                    <span className="text-xs font-sans font-medium uppercase tracking-wider bg-background/90 text-foreground border border-border px-3 py-1.5 rounded-full">
                      {product.tag}
                    </span>
                  </div>
                ) : null}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-serif text-xl text-card-foreground mb-2">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground font-sans leading-relaxed flex-1 mb-4">
                      {product.description}
                    </p>
                  )}
                  <p className="font-sans font-semibold text-foreground text-lg mb-4">{formatPrice(product)}</p>

                  <ProductCTA product={product} onBuy={setSelectedProduct} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 text-center bg-secondary/40 rounded-2xl p-10 lg:p-16">
          <h2 className="text-2xl lg:text-3xl font-serif text-foreground mb-4">Questions or corporate bookings?</h2>
          <p className="text-muted-foreground font-serif mb-6">
            We offer tailored corporate wellness programs with 10+ years of experience. Get in touch.
          </p>
          <a
            href="mailto:contact@yogabrie.com"
            className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
          >
            Contact us
          </a>
        </div>
      </section>

      <Footer />

      <ProductPurchaseSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};

const ProductCTA = ({ product, onBuy }: { product: Product; onBuy: (p: Product) => void }) => {
  const ctaClass =
    "w-full text-center bg-primary hover:bg-primary/80 text-primary-foreground py-3 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all";
  const ctaSecondaryClass =
    "w-full text-center border border-border hover:bg-muted/30 text-foreground py-3 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all";

  if (product.requires_contact) {
    return (
      <a href="mailto:contact@yogabrie.com" className={ctaSecondaryClass}>
        Contact us
      </a>
    );
  }

  if (product.type === "drop_in") {
    return (
      <Link to="/" className={ctaSecondaryClass}>
        Browse classes
      </Link>
    );
  }

  if (product.type === "subscription") {
    return (
      <button type="button" onClick={() => onBuy(product)} className={ctaClass}>
        Subscribe
      </button>
    );
  }

  return (
    <button type="button" onClick={() => onBuy(product)} className={ctaClass}>
      Buy now
    </button>
  );
};

export default JoinNow;
