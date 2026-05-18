"use client";

import { ProfileEditor } from "@/app/shared/ProfileEditor";
import styles from "./profile.module.css";

export const ProfilePage = () => {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>505 Market profile</p>
        <h1>Make your seller profile feel trustworthy.</h1>
        <p className={styles.subtitle}>
          Add a display name, meetup preferences, and a short bio so first-time buyers know who they are messaging.
        </p>
      </header>

      <ProfileEditor />
    </div>
  );
};
