import Header from "@/components/Header";
import Footer from "@/components/Footer";

const products = [
  {
    img: "/images/shop/dropin.jpeg",
    name: "Drop-in",
    price: "kr 250",
    desc: "Single class. No commitment, no card needed. Show up and practice.",
    tag: "Flexible",
  },
  {
    img: "/images/shop/clipcard10.jpeg",
    name: "10× Clip Card",
    price: "kr 2,300",
    desc: "Ten classes at a reduced rate. Use across any class type at any time.",
    tag: "Best value",
  },
  {
    img: "/images/shop/allincl.jpeg",
    name: "All-Inclusive",
    price: "kr 1,600 / month",
    desc: "Unlimited access to all classes for one month. Roll month-to-month, cancel anytime.",
    tag: "Most popular",
  },
  {
    img: "/images/shop/membership1.jpeg",
    name: "1-Year Membership",
    price: "kr 1,250 / month",
    desc: "Unlimited access with a 12-month commitment. Best monthly rate we offer.",
    tag: "Committed",
  },
  {
    img: "/images/shop/mathotel.jpeg",
    name: "Mat Hotel",
    price: "kr 50 / month",
    desc: "We store your mat at the studio so you never have to carry it. Monthly add-on.",
    tag: "Add-on",
  },
  {
    img: "/images/shop/private60mn.jpeg",
    name: "Private Session — 60 min",
    price: "kr 1,500",
    desc: "One-on-one instruction tailored entirely to your needs and current practice.",
    tag: "Private",
  },
  {
    img: "/images/shop/private90mn.jpeg",
    name: "Private Session — 90 min",
    price: "kr 1,900",
    desc: "Extended private session. Ideal for deeper work, injury recovery, or focused technique.",
    tag: "Private",
  },
];

const JoinNow = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-4">Pricing</p>
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed mb-6">
          Memberships &amp; classes
        </h1>
        <p className="text-lg text-muted-foreground font-serif max-w-2xl mx-auto">
          Purchase in studio or contact us at{" "}
          <a href="mailto:contact@yogabrie.com" className="underline hover:text-foreground transition-colors">
            contact@yogabrie.com
          </a>
          . Prices include VAT.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((product) => (
            <div key={product.name} className="bg-card rounded-xl overflow-hidden flex flex-col">
              <div className="relative">
                <img
                  src={product.img}
                  alt={product.name}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <span className="absolute top-3 left-3 text-xs font-sans font-medium uppercase tracking-wider bg-background/90 text-foreground px-3 py-1.5 rounded-full">
                  {product.tag}
                </span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-serif text-xl text-card-foreground mb-2">{product.name}</h3>
                <p className="text-sm text-muted-foreground font-sans leading-relaxed flex-1 mb-4">{product.desc}</p>
                <p className="font-sans font-semibold text-foreground text-lg">{product.price}</p>
              </div>
            </div>
          ))}
        </div>

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
    </div>
  );
};

export default JoinNow;
