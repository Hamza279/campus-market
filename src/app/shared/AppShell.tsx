"use client";

import { useEffect, useState } from "react";
import type { AuthUser } from "@/auth/types";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: React.ReactNode;
  currentUser?: Pick<AuthUser, "email" | "name" | "avatarUrl"> | null;
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

export const AppShell = ({ children, currentUser = null }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pathname, setPathname] = useState("/");

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const renderNavLinks = (variant: "desktop" | "mobile") => {
    const userLabel = currentUser?.name || currentUser?.email;

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
        {currentUser ? (
          <div className={variant === "desktop" ? styles.userMenu : `${styles.userMenu} ${styles.mobileUserMenu}`}>
            {currentUser.avatarUrl ? (
              <img className={styles.avatar} src={currentUser.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className={styles.avatarFallback}>{(userLabel ?? "U").slice(0, 1).toUpperCase()}</span>
            )}
            <span className={styles.userLabel}>{userLabel}</span>
            <a className={styles.authButton} href="/logout" onClick={closeMenu}>
              Logout
            </a>
          </div>
        ) : (
          <a
            className={variant === "desktop" ? styles.authButton : `${styles.authButton} ${styles.mobileAuthButton}`}
            href="/login"
            onClick={closeMenu}
          >
            Login
          </a>
        )}
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
