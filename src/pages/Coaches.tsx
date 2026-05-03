import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";
import { usePublicInstructors } from "@/hooks/usePublicInstructors";

const Coaches = () => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const { instructors, isLoading } = usePublicInstructors();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-4">The team</p>
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed">
          Dedicated teachers committed to supporting your practice.
        </h1>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36 space-y-24 lg:space-y-36">
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {!isLoading && instructors.map((instructor, i) => (
          <div
            key={instructor.id}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
              i % 2 === 1 ? "lg:grid-flow-dense" : ""
            }`}
          >
            {instructor.image_url ? (
              <img
                src={instructor.image_url}
                alt={instructor.display_name}
                className={`w-full aspect-[3/4] object-cover rounded-lg ${i % 2 === 1 ? "lg:col-start-2" : ""}`}
                loading="lazy"
              />
            ) : (
              <div
                className={`w-full aspect-[3/4] rounded-lg bg-muted flex items-center justify-center ${i % 2 === 1 ? "lg:col-start-2" : ""}`}
              >
                <span className="text-6xl font-serif text-muted-foreground">
                  {instructor.display_name.charAt(0)}
                </span>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h2 className="text-3xl lg:text-4xl font-serif text-foreground">{instructor.display_name}</h2>
                {instructor.specialty && (
                  <p className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground mt-2">
                    {instructor.specialty}
                  </p>
                )}
              </div>
              {instructor.bio && (
                <p className="text-lg text-muted-foreground leading-relaxed font-serif">{instructor.bio}</p>
              )}
              {instructor.class_names.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-2">Classes</p>
                  <div className="flex flex-wrap gap-2">
                    {instructor.class_names.map((cls) => (
                      <span key={cls} className="text-xs font-sans px-3 py-1.5 bg-secondary rounded-full text-foreground">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground px-8 py-4 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
              >
                Book a Session
              </button>
            </div>
          </div>
        ))}
      </section>

      <Footer />
      <BookingSheet isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
};

export default Coaches;
