"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    match: (pathname) => pathname === "/",
  },
  {
    label: "Listings",
    href: "/listings",
    match: (pathname) => pathname === "/listings" || pathname.startsWith("/listings/") || pathname.startsWith("/listing/"),
  },
  {
    label: "Sell an Item",
    href: "/sell",
    match: (pathname) => pathname === "/sell",
  },
  {
    label: "Seller Dashboard",
    href: "/dashboard",
    match: (pathname) => pathname === "/dashboard" || pathname.startsWith("/edit/"),
  },
  {
    label: "Messages",
    href: "/messages",
    match: (pathname) => pathname === "/messages",
  },
  {
    label: "Saved Items",
    href: "/saved",
    match: (pathname) => pathname === "/saved",
  },
];

export const AppShell = ({ children }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pathname, setPathname] = useState("/");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setPathname(window.location.pathname);

    try {
      setIsLoggedIn(window.localStorage.getItem("campus-market-auth-placeholder") === "true");
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const authLabel = useMemo(() => (isLoggedIn ? "Logout" : "Login"), [isLoggedIn]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleAuthClick = () => {
    // TODO: Replace this local placeholder with the real auth provider once auth is wired.
    setIsLoggedIn((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("campus-market-auth-placeholder", String(next));
      } catch {
        // Local storage is only used for this temporary menu placeholder.
      }
      return next;
    });
    closeMenu();
  };

  const renderNavLinks = (variant: "desktop" | "mobile") => {
    return (
      <>
        {navItems.map((item) => {
          const active = item.match(pathname);

          return (
            <a
              key={item.href}
              href={item.href}
              className={active ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}
              aria-current={active ? "page" : undefined}
              onClick={closeMenu}
            >
              {item.label}
            </a>
          );
        })}
        <button
          type="button"
          className={variant === "desktop" ? styles.authButton : `${styles.authButton} ${styles.mobileAuthButton}`}
          onClick={handleAuthClick}
        >
          {authLabel}
        </button>
      </>
    );
  };

  return (
    <div className={styles.shell}>
      <header className={styles.siteHeader}>
        <a href="/" className={styles.brand} onClick={closeMenu}>
          <span className={styles.brandMark}>CM</span>
          <span>CampusMarket</span>
        </a>

        <nav className={styles.desktopNav} aria-label="Primary navigation">
          {renderNavLinks("desktop")}
        </nav>

        <button
          type="button"
          className={styles.menuButton}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen ? (
        <nav id="mobile-navigation" className={styles.mobileNav} aria-label="Primary navigation">
          {renderNavLinks("mobile")}
        </nav>
      ) : null}

      <main className={styles.main}>{children}</main>
    </div>
  );
};
