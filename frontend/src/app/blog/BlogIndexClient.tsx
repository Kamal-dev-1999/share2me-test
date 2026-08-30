"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Calendar, User } from "lucide-react";
import { motion } from "framer-motion";
import ClientImage from "./[slug]/ClientImage";

export default function BlogIndexClient({ initialArticles = [] }: { initialArticles: any[] }) {
  const articlesList = useMemo(() => {
    return initialArticles.map((article) => {
      const imgMatch = (article.intro || "").match(/!\[(.*?)\]\((.*?)\)/);
      let safeUrl = null;
      if (imgMatch) {
        try {
          safeUrl = encodeURI(decodeURI(imgMatch[2]));
        } catch (e) {
          safeUrl = imgMatch[2].replace(/ /g, '%20');
        }
      }
      const cleanIntro = (article.intro || "").replace(/!\[.*?\]\((.*?)\)/g, '').trim();
      const slugDateMatch = article.slug.match(/^(\d{4}-\d{2}-\d{2})/);
      const reliableDate = slugDateMatch ? slugDateMatch[1] : article.date;
      
      return {
        slug: article.slug,
        title: article.title,
        excerpt: cleanIntro.substring(0, 150) + "...",
        category: article.category || "Uncategorized",
        readTime: article.readTime,
        date: reliableDate,
        imageUrl: safeUrl,
        author: article.author,
      };
    });
  }, [initialArticles]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const categories = useMemo(() => {
    const cats = new Set(articlesList.map(a => a.category));
    return ["All", ...Array.from(cats)];
  }, [articlesList]);

  const sortedArticles = useMemo(() => {
    return [...articlesList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [articlesList]);

  // If no search/filter, extract the featured article (the newest one)
  const isDefaultView = searchQuery === "" && activeCategory === "All" && currentPage === 1;
  const featuredArticle = isDefaultView && sortedArticles.length > 0 ? sortedArticles[0] : null;

  // The rest of the articles for the grid
  const gridArticles = isDefaultView ? sortedArticles.slice(1) : sortedArticles;

  const filteredArticles = useMemo(() => {
    return gridArticles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === "All" || article.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [gridArticles, searchQuery, activeCategory]);

  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage) || 1;
  const boundedCurrentPage = Math.min(currentPage, totalPages);

  const paginatedArticles = useMemo(() => {
    const start = (boundedCurrentPage - 1) * itemsPerPage;
    return filteredArticles.slice(start, start + itemsPerPage);
  }, [filteredArticles, boundedCurrentPage]);

  // Handle page resets on filter change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-text-primary font-sans">
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 lg:px-8 py-16 relative z-10">

        {/* Header Block */}
        <div className="mb-12 pt-8">
          <span className="text-primary font-bold text-sm tracking-wide uppercase mb-2 block">Share2Me Blog</span>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-4">
            Browse Our Resources
          </h1>
          <p className="text-[16px] md:text-[18px] text-text-secondary max-w-2xl">
            We provide tips and resources from industry leaders. For free.
          </p>
        </div>

        {/* Featured Hero Article */}
        {featuredArticle && (
          <Link href={`/blog/${featuredArticle.slug}`} className="block mb-16 group">
            <div className="relative w-full h-[400px] md:h-[500px] rounded-[32px] overflow-hidden shadow-2xl">
              {featuredArticle.imageUrl ? (
                <ClientImage src={featuredArticle.imageUrl} alt={featuredArticle.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full bg-background-elevated" />
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                <h2 style={{ color: "#ffffff" }} className="text-3xl md:text-4xl font-bold mb-4 leading-tight group-hover:text-primary transition-colors">
                  {featuredArticle.title}
                </h2>
                <div style={{ color: "rgba(255,255,255,0.9)" }} className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{featuredArticle.author || "Kamal"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(featuredArticle.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white border border-white/10" style={{ color: "#ffffff" }}>
                    {featuredArticle.category}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Search and Filters */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-border/50 pb-6">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-hide pb-2 md:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all duration-200 ${activeCategory === cat
                      ? "bg-text-primary text-background"
                      : "text-text-secondary hover:text-text-primary hover:bg-background-elevated border border-transparent hover:border-border"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-72 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-text-tertiary group-focus-within:text-text-primary transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full bg-background-card border border-border rounded-full py-2 pl-10 pr-4 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all shadow-sm"
              />
            </div>
          </div>
        </section>

        {/* Articles Feed */}
        <section className="mb-20">
          {paginatedArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {paginatedArticles.map((article, i) => (
                <motion.div
                  key={article.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="h-full"
                >
                  <Link href={`/blog/${article.slug}`} className="group flex flex-col h-full bg-background-card rounded-[24px] overflow-hidden border border-border/40 hover:border-border transition-all duration-300 shadow-sm hover:shadow-lg">
                    {/* Image */}
                    <div className="relative w-full h-[200px] overflow-hidden bg-background-elevated">
                      {article.imageUrl ? (
                        <ClientImage
                          src={article.imageUrl}
                          alt={article.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-background-elevated flex items-center justify-center">
                          <span className="text-text-tertiary text-xs uppercase font-bold tracking-widest">{article.category}</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col flex-1">
                      <span className="text-primary font-bold text-[12px] tracking-wide uppercase mb-3 block">
                        {article.category}
                      </span>
                      <h3 className="text-[20px] font-bold text-text-primary mb-3 leading-snug group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-[14px] text-text-secondary leading-relaxed mb-6 flex-1">
                        {article.excerpt}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-[12px] text-text-tertiary border-t border-border/40 pt-4 mt-auto">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5" />
                          <span>{article.author || "Kamal"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(article.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-background-card rounded-[24px] border border-border">
              <Search className="w-8 h-8 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-bold text-text-primary mb-2">No results found</h3>
              <p className="text-text-secondary text-sm">We couldn't find any articles matching "{searchQuery}"</p>
            </div>
          )}
        </section>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-32">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={boundedCurrentPage === 1}
              className="w-10 h-10 rounded-full border border-border bg-background-elevated flex items-center justify-center text-text-primary hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-full text-[14px] font-bold transition-all ${boundedCurrentPage === page
                        ? "bg-text-primary text-background"
                        : "bg-transparent text-text-secondary hover:text-text-primary hover:bg-background-elevated"
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={boundedCurrentPage === totalPages}
              className="w-10 h-10 rounded-full border border-border bg-background-elevated flex items-center justify-center text-text-primary hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
