import styles from "./home.module.css";

const categories = [
  { label: "Books", icon: "BOOK", tone: "blue", description: "Textbooks, novels, course packs" },
  { label: "Electronics", icon: "TECH", tone: "teal", description: "Laptop gear, headphones, chargers" },
  { label: "Furniture", icon: "DESK", tone: "amber", description: "Desks, chairs, lamps, shelves" },
  { label: "Supplies", icon: "BAG", tone: "rose", description: "Backpacks, calculators, class tools" },
  { label: "Bikes", icon: "BIKE", tone: "green", description: "Bikes, locks, helmets, scooters" },
  { label: "Dorm", icon: "DORM", tone: "violet", description: "Mini fridges, bedding, decor" },
] as const;

const featuredListings = [
  {
    title: "Campus Textbook Bundle",
    price: "$48",
    category: "Books",
    location: "Dorm A",
    condition: "Gently used",
    badge: "Best value",
  },
  {
    title: "Laptop Stand + Wireless Mouse",
    price: "$32",
    category: "Electronics",
    location: "North Quad",
    condition: "Excellent",
    badge: "Study setup",
  },
  {
    title: "Commuter Bike with Lock",
    price: "$85",
    category: "Bikes",
    location: "West Hall",
    condition: "Good",
    badge: "Popular",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Browse",
    text: "Scan active listings by category, location, condition, and price before you reach out.",
  },
  {
    step: "02",
    title: "Message seller",
    text: "Contact the seller with a simple note and confirm the item details or pickup window.",
  },
  {
    step: "03",
    title: "Meet safely on campus",
    text: "Choose a public campus spot, inspect the item, and finish the exchange in person.",
  },
] as const;

export const Home = () => {
  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Student-to-student marketplace</p>
            <h1 className={styles.heroTitle}>Find the campus gear you need. Sell what you do not.</h1>
            <p className={styles.heroText}>
              CampusMarket helps students buy and sell textbooks, dorm essentials, bikes, and everyday gear with people nearby.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/listings">
                Browse listings
              </a>
              <a className={styles.secondaryButton} href="/sell">
                Sell an item
              </a>
            </div>
          </div>

          <aside className={styles.heroCard} aria-label="Marketplace snapshot">
            <div className={styles.heroCardHeader}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span className={styles.heroCardKicker}>Fresh on CampusMarket</span>
            </div>
            <div className={styles.heroListing}>
              <span className={styles.heroListingTag}>Books</span>
              <strong className={styles.heroListingTitle}>Semester textbook bundle</strong>
              <span className={styles.heroListingMeta}>Dorm A • Gently used</span>
              <div className={styles.heroListingFooter}>
                <strong className={styles.heroListingPrice}>$48</strong>
                <a className={styles.smallButton} href="/listings">
                  View deal
                </a>
              </div>
            </div>
            <div className={styles.miniStats}>
              <div className={styles.miniStat}>
                <strong className={styles.miniStatValue}>7</strong>
                <span className={styles.miniStatLabel}>Categories</span>
              </div>
              <div className={styles.miniStat}>
                <strong className={styles.miniStatValue}>Fast</strong>
                <span className={styles.miniStatLabel}>Posting</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="categories-title">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Explore categories</p>
          <h2 className={styles.sectionTitle} id="categories-title">
            Shop the stuff students actually need.
          </h2>
        </div>
        <div className={styles.categoryGrid}>
          {categories.map((category) => (
            <a className={`${styles.categoryCard} ${styles[category.tone]}`} href="/listings" key={category.label}>
              <span className={styles.categoryIcon}>{category.icon}</span>
              <strong className={styles.categoryTitle}>{category.label}</strong>
              <span className={styles.categoryDescription}>{category.description}</span>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="featured-title">
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Featured listings</p>
            <h2 className={styles.sectionTitle} id="featured-title">
              Good finds around campus.
            </h2>
          </div>
          <a className={styles.sectionButton} href="/listings">
            See all listings
          </a>
        </div>
        <div className={styles.featuredGrid}>
          {featuredListings.map((listing) => (
            <article className={styles.listingCard} key={listing.title}>
              <div className={styles.listingVisual}>
                <span className={styles.listingBadge}>{listing.badge}</span>
              </div>
              <div className={styles.listingContent}>
                <div className={styles.listingTopline}>
                  <span className={styles.listingCategory}>{listing.category}</span>
                  <strong className={styles.listingPrice}>{listing.price}</strong>
                </div>
                <h3 className={styles.listingTitle}>{listing.title}</h3>
                <dl className={styles.listingDetails}>
                  <div className={styles.detailItem}>
                    <dt className={styles.detailLabel}>Location</dt>
                    <dd className={styles.detailValue}>{listing.location}</dd>
                  </div>
                  <div className={styles.detailItem}>
                    <dt className={styles.detailLabel}>Condition</dt>
                    <dd className={styles.detailValue}>{listing.condition}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.howSection} aria-labelledby="how-title">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2 className={styles.sectionTitle} id="how-title">
            Simple enough to use between classes.
          </h2>
        </div>
        <div className={styles.stepGrid}>
          {steps.map((item) => (
            <article className={styles.stepCard} key={item.title}>
              <span className={styles.stepNumber}>{item.step}</span>
              <strong className={styles.stepTitle}>{item.title}</strong>
              <p className={styles.stepText}>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection} aria-labelledby="cta-title">
        <div className={styles.ctaCard}>
          <div className={styles.ctaCopy}>
            <p className={styles.sectionEyebrow}>Ready when you are</p>
            <h2 className={styles.ctaTitle} id="cta-title">
              Post your first listing or browse what students are selling today.
            </h2>
          </div>
          <div className={styles.ctaActions}>
            <a className={styles.primaryButton} href="/sell">
              Sell an item
            </a>
            <a className={styles.secondaryButton} href="/listings">
              Browse listings
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
