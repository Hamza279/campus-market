"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/auth/types";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: React.ReactNode;
  currentUser?: Pick<AuthUser, "email" | "name" | "avatarUrl"> | null;
}

interface NavItem {
  label: string;
  mobileLabel?: string;
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
    label: "Browse",
    mobileLabel: "Listings",
    href: "/listings",
    match: (pathname) => pathname === "/listings" || pathname.startsWith("/listings/") || pathname.startsWith("/listing/"),
  },
  {
    label: "Sell",
    mobileLabel: "Sell an Item",
    href: "/sell",
    match: (pathname) => pathname === "/sell",
  },
  {
    label: "Dashboard",
    mobileLabel: "Seller Dashboard",
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (menuButtonRef.current?.contains(target) || mobileNavRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const renderSessionControls = () => {
    const userLabel = currentUser?.name || currentUser?.email;
    const greetingName = currentUser?.name?.split(" ")[0] || currentUser?.email?.split("@")[0] || "there";
    const greetingLabel = `Hi ${greetingName}`;

    return currentUser ? (
      <div className={styles.userMenu}>
        {currentUser.avatarUrl ? (
          <img className={styles.avatar} src={currentUser.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.avatarFallback}>{(userLabel ?? "U").slice(0, 1).toUpperCase()}</span>
        )}
        <span className={styles.userLabel}>{greetingLabel}</span>
        <a className={styles.authButton} href="/logout" onClick={closeMenu}>
          Logout
        </a>
      </div>
    ) : (
      <a className={styles.authButton} href="/login" onClick={closeMenu}>
        Login
      </a>
    );
  };

  const renderMenuLinks = () => {
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
              {item.mobileLabel ?? item.label}
            </a>
          );
        })}
        {currentUser ? (
          <a className={styles.navLink} href="/logout" onClick={closeMenu}>
            Logout
          </a>
        ) : (
          <a className={`${styles.navLink} ${styles.mobileAuthButton}`} href="/login" onClick={closeMenu}>
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
          {renderSessionControls()}
        </nav>

        <button
          type="button"
          className={styles.menuButton}
          ref={menuButtonRef}
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

      <nav
        id="mobile-navigation"
        className={menuOpen ? `${styles.mobileNav} ${styles.mobileNavOpen}` : styles.mobileNav}
        aria-label="Primary navigation"
        aria-hidden={!menuOpen}
        ref={mobileNavRef}
      >
        {renderMenuLinks()}
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
};
