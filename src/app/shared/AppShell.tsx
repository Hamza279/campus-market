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
  shortLabel?: string;
  icon: string;
  href: string;
  match: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    shortLabel: "Home",
    icon: "Home",
    href: "/",
    match: (pathname) => pathname === "/",
  },
  {
    label: "Browse",
    mobileLabel: "Listings",
    shortLabel: "Browse",
    icon: "Browse",
    href: "/listings",
    match: (pathname) => pathname === "/listings" || pathname.startsWith("/listings/") || pathname.startsWith("/listing/"),
  },
  {
    label: "Sell",
    mobileLabel: "List an Item",
    shortLabel: "Sell",
    icon: "Sell",
    href: "/sell",
    match: (pathname) => pathname === "/sell",
  },
  {
    label: "Account",
    mobileLabel: "Account",
    shortLabel: "Account",
    icon: "Hub",
    href: "/dashboard",
    match: (pathname) => pathname === "/dashboard" || pathname === "/profile" || pathname.startsWith("/edit/"),
  },
  {
    label: "Messages",
    shortLabel: "Messages",
    icon: "Chat",
    href: "/messages",
    match: (pathname) => pathname === "/messages" || pathname.startsWith("/messages/"),
  },
  {
    label: "Saved",
    shortLabel: "Saved",
    icon: "Saved",
    href: "/saved",
    match: (pathname) => pathname === "/saved",
  },
];

export const AppShell = ({ children, currentUser = null }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pathname, setPathname] = useState(typeof window === "undefined" ? "/" : window.location.pathname);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const syncPathname = () => {
      setPathname(window.location.pathname);
      setMenuOpen(false);
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args) => {
      originalPushState(...args);
      syncPathname();
    }) as History["pushState"];

    window.history.replaceState = ((...args) => {
      originalReplaceState(...args);
      syncPathname();
    }) as History["replaceState"];

    window.addEventListener("popstate", syncPathname);
    window.addEventListener("pageshow", syncPathname);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", syncPathname);
      window.removeEventListener("pageshow", syncPathname);
    };
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

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    const handleResize = () => {
      if (window.innerWidth > 980) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", handleResize);
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
          Log out
        </a>
      </div>
    ) : (
      <a className={styles.authButton} href="/login" onClick={closeMenu}>
        Log in
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
            Log out
          </a>
        ) : (
          <a className={`${styles.navLink} ${styles.mobileAuthButton}`} href="/login" onClick={closeMenu}>
            Log in
          </a>
        )}
      </>
    );
  };

  const mobileTabs = navItems.filter((item) => ["/", "/listings", "/sell", "/messages", "/dashboard"].includes(item.href));

  return (
    <div className={styles.shell}>
      <header className={styles.siteHeader}>
        <a href="/" className={styles.brand} onClick={closeMenu}>
          <span className={styles.brandMark}>505</span>
          <span>505 Market</span>
        </a>

        <nav className={styles.desktopNav} aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = item.match(pathname);

            return (
              <a
                key={item.href}
                href={item.href}
                className={active ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </a>
            );
          })}
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
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
      </header>

      <div className={menuOpen ? `${styles.mobileBackdrop} ${styles.mobileBackdropOpen}` : styles.mobileBackdrop} />
      <nav
        id="mobile-navigation"
        className={menuOpen ? `${styles.mobileNav} ${styles.mobileNavOpen}` : styles.mobileNav}
        aria-label="Primary navigation"
        aria-hidden={!menuOpen}
        ref={mobileNavRef}
      >
        <div className={styles.mobileNavHeader}>
          <span className={styles.mobileNavTitle}>Menu</span>
          {currentUser ? <span className={styles.mobileNavSubtitle}>{currentUser.name || currentUser.email}</span> : null}
        </div>
        {renderMenuLinks()}
      </nav>

      <main className={styles.main}>{children}</main>

      <nav className={styles.bottomNav} aria-label="Mobile bottom navigation">
        {mobileTabs.map((item) => {
          const active = item.match(pathname);

          return (
            <a
              key={item.href}
              href={item.href}
              className={active ? `${styles.bottomNavLink} ${styles.bottomNavLinkActive}` : styles.bottomNavLink}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.bottomNavIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.bottomNavLabel}>{item.shortLabel ?? item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
};
