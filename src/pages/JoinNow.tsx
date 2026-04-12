import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignUpSheet, { type SignUpPlan } from "@/components/SignUpSheet";
import plan1 from "@/assets/plan-1.webp";
import plan2 from "@/assets/plan-2.webp";
import plan3 from "@/assets/plan-3.webp";

const plans = [
  {
    img: plan1,
    name: "Yoga Principles",
    desc: "Explore different styles of yoga & meditation with foundational tutorial videos for both beginners and experienced practitioners.",
    price: "Free",
    bg: "bg-card",
    text: "text-card-foreground",
    mutedText: "text-muted-foreground",
    btnClass: "bg-primary hover:bg-primary/80 text-primary-foreground",
  },
  {
    img: plan2,
    name: "Unlimited Yoga & Meditation",
    desc: "Keep your options open with a full virtual library of classes, ranging from 5-minute meditations to 75-minute yoga flows.",
    price: "$15/mo",
    bg: "bg-secondary",
    text: "text-secondary-foreground",
    mutedText: "text-muted-foreground",
    btnClass: "bg-primary hover:bg-primary/80 text-primary-foreground",
  },
  {
    img: plan3,
    name: "300-hr Teacher Training",
    desc: "Take your practice to the next level by participating in our certified yoga teacher training program. Learn more about our approach.",
    price: "$3,500",
    bg: "bg-primary",
    text: "text-primary-foreground",
    mutedText: "text-primary-foreground/70",
    btnClass: "bg-foreground hover:bg-foreground/80 text-background",
  },
];

const JoinNow = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SignUpPlan | undefined>();

  const handleSelectPlan = (plan: typeof plans[0]) => {
    setSelectedPlan({ name: plan.name, price: plan.price, desc: plan.desc });
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="py-16 lg:py-24">
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground text-center mb-16 lg:mb-24 animate-fade-in">
          Choose a practice plan
        </h1>

        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`${plan.bg} rounded-xl overflow-hidden flex flex-col`}
              >
                <img
                  src={plan.img}
                  alt={plan.name}
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
                <div className="p-6 lg:p-8 flex flex-col flex-grow text-center">
                  <h2 className={`text-xl lg:text-2xl font-serif ${plan.text} mb-3`}>
                    {plan.name}
                  </h2>
                  <p className={`text-sm ${plan.mutedText} leading-relaxed font-serif flex-grow`}>
                    {plan.desc}
                  </p>
                  <p className={`text-2xl font-serif ${plan.text} mt-6 mb-6`}>
                    {plan.price}
                  </p>
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`${plan.btnClass} px-10 py-3 font-sans font-medium text-sm uppercase tracking-wider transition-all rounded-lg`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer tagline="Stay in the Loop" />

      <SignUpSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} plan={selectedPlan} />
    </div>
  );
};

export default JoinNow;
