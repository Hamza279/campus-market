export const loadStyles = () =>
  Promise.all([
    import("@/app/pages/dashboard.module.css"),
    import("@/app/pages/edit.module.css"),
    import("@/app/pages/home.module.css"),
    import("@/app/pages/listing.module.css"),
    import("@/app/pages/listings.module.css"),
    import("@/app/pages/login.module.css"),
    import("@/app/pages/placeholder.module.css"),
    import("@/app/pages/realtime-debug.module.css"),
    import("@/app/pages/sell.module.css"),
    import("@/app/pages/seller.module.css"),
    import("@/app/pages/welcome.module.css"),
    import("@/app/shared/AppShell.module.css"),
    import("@/app/shared/ListingCard.module.css"),
  ]);
