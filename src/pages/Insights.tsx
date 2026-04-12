import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import blog1 from "@/assets/blog-1.webp";
import blog2 from "@/assets/blog-2.webp";
import blog3 from "@/assets/blog-3.webp";
import blog4 from "@/assets/blog-4.webp";
import blog5 from "@/assets/blog-5.webp";
import blog6 from "@/assets/blog-6.webp";
import blog7 from "@/assets/blog-7.webp";
import blog8 from "@/assets/blog-8.webp";

const articles = [
  { img: blog1, title: "Sharing your practice with family", slug: "building-wellness-habits", aspect: "aspect-[4/3]" },
  { img: blog2, title: "Setting up your space", slug: "home-fitness-sanctuary", aspect: "aspect-[3/4]" },
  { img: blog3, title: "The importance of getting out of our comfort zone", slug: "discomfort-essential-growth", aspect: "aspect-[4/3]" },
  { img: blog4, title: "Poses 101: Lunge", slug: "perfect-squat", aspect: "aspect-[3/4]" },
  { img: blog5, title: "Finding light in darkness", slug: "finding-balance", aspect: "aspect-square" },
  { img: blog6, title: "What we can learn from water", slug: "20-minute-workout", aspect: "aspect-[2/3]" },
  { img: blog7, title: "Taking a 15-minute yoga break", slug: "lessons-resilience-nature", aspect: "aspect-[4/3]" },
  { img: blog8, title: "A beginner's guide to meditation", slug: "mindful-eating-guide", aspect: "aspect-[3/4]" },
];

const columns = [
  [articles[0], articles[4]],
  [articles[1], articles[5]],
  [articles[2], articles[6]],
  [articles[3], articles[7]],
];

const columnOffsets = ["pt-0", "pt-8 lg:pt-12", "pt-0", "pt-4 lg:pt-6"];

const Insights = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 lg:gap-x-8">
          {columns.map((col, colIndex) => (
            <div key={colIndex} className={`space-y-10 lg:space-y-14 ${columnOffsets[colIndex]}`}>
              {col.map((article) => (
                <Link to={`/insights/${article.slug}`} key={article.slug} className="block group">
                  <img
                    src={article.img}
                    alt={article.title}
                    className={`w-full ${article.aspect} object-cover hover:opacity-90 transition-opacity`}
                    loading="lazy"
                  />
                  <h3 className="text-base font-serif text-foreground mt-4 group-hover:text-primary transition-colors leading-snug">
                    {article.title}
                  </h3>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <Footer tagline="Stay in the Loop" />
    </div>
  );
};

export default Insights;
