"use client";

import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, type MarketplaceProfile } from "@/app/pages/profile.data";
import styles from "./ProfileEditor.module.css";

interface ProfileEditorProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

type ProfileForm = {
  name: string;
  avatarUrl: string;
  bio: string;
  campusAffiliation: string;
  neighborhood: string;
  meetupLocation: string;
  responseTime: string;
  interests: string;
  contactPreference: string;
};

const emptyForm: ProfileForm = {
  name: "",
  avatarUrl: "",
  bio: "",
  campusAffiliation: "",
  neighborhood: "",
  meetupLocation: "",
  responseTime: "",
  interests: "",
  contactPreference: "",
};

const toForm = (profile: MarketplaceProfile): ProfileForm => ({
  name: profile.name,
  avatarUrl: profile.avatarUrl,
  bio: profile.bio,
  campusAffiliation: profile.campusAffiliation,
  neighborhood: profile.neighborhood,
  meetupLocation: profile.meetupLocation,
  responseTime: profile.responseTime,
  interests: profile.interests,
  contactPreference: profile.contactPreference,
});

const getFallbackName = (profile: MarketplaceProfile | null, form: ProfileForm) => {
  return form.name.trim() || profile?.name || "505 Market Seller";
};

const getInitial = (profile: MarketplaceProfile | null, form: ProfileForm) => {
  return (getFallbackName(profile, form) || profile?.email || "5").slice(0, 1).toUpperCase();
};

const getProfileCompletion = (form: ProfileForm) => {
  const completedFields = [
    form.name,
    form.avatarUrl,
    form.bio,
    form.campusAffiliation,
    form.neighborhood,
    form.meetupLocation,
    form.responseTime,
    form.interests,
    form.contactPreference,
  ].filter((value) => value.trim()).length;

  return Math.round((completedFields / 9) * 100);
};

export const ProfileEditor = ({
  title = "Your profile",
  subtitle = "Tell buyers who you are, where you like to meet, and how quickly you usually reply.",
  compact = false,
}: ProfileEditorProps) => {
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await getMyProfile();
        if (!cancelled) {
          setProfile(loaded);
          setForm(toForm(loaded));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load your profile.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSuccess(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateMyProfile(form);
      setProfile(updated);
      setForm(toForm(updated));
      setSuccess("Profile saved. Your public seller page is updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const containerClassName = compact ? `${styles.panel} ${styles.compactPanel}` : styles.panel;
  const sellerName = getFallbackName(profile, form);
  const profileCompletion = getProfileCompletion(form);
  const previewPills = [
    form.campusAffiliation,
    form.neighborhood,
    form.meetupLocation,
    form.responseTime,
    form.contactPreference,
  ].filter((value) => value.trim());
  const interestList = form.interests
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <section className={containerClassName} aria-labelledby="profile-editor-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Profile</p>
          <h2 id="profile-editor-title">{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div className={styles.avatarWrap}>
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt={sellerName || "Profile avatar"} className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback}>{getInitial(profile, form)}</span>
          )}
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {success ? <p className={styles.success}>{success}</p> : null}

      {isLoading ? (
        <p className={styles.loading}>Loading your profile…</p>
      ) : (
        <div className={styles.content}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Display name</span>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Lobo Seller" />
                <small>Shown on your listings and public seller page.</small>
              </label>
              <label className={styles.field}>
                <span>Avatar URL</span>
                <input name="avatarUrl" value={form.avatarUrl} onChange={handleChange} placeholder="https://example.com/me.jpg" />
                <small>Paste an image URL if you want a profile photo.</small>
              </label>
              <label className={styles.field}>
                <span>Campus affiliation</span>
                <input name="campusAffiliation" value={form.campusAffiliation} onChange={handleChange} placeholder="UNM student, alum, or nearby neighbor" />
                <small>Help buyers understand your connection to campus.</small>
              </label>
              <label className={styles.field}>
                <span>Neighborhood</span>
                <input name="neighborhood" value={form.neighborhood} onChange={handleChange} placeholder="Nob Hill, Downtown, North Campus" />
                <small>Optional area for local meetups.</small>
              </label>
              <label className={styles.field}>
                <span>Preferred meetup spot</span>
                <input name="meetupLocation" value={form.meetupLocation} onChange={handleChange} placeholder="Student Union, Zimmerman, Frontier" />
                <small>Tell buyers where you usually like to meet.</small>
              </label>
              <label className={styles.field}>
                <span>Typical response time</span>
                <input name="responseTime" value={form.responseTime} onChange={handleChange} placeholder="Usually within a few hours" />
                <small>Set expectations before someone messages you.</small>
              </label>
              <label className={styles.field}>
                <span>Interests or seller badges</span>
                <input name="interests" value={form.interests} onChange={handleChange} placeholder="Textbooks, bikes, dorm setup" />
                <small>Simple keywords help your profile feel more personal.</small>
              </label>
              <label className={styles.field}>
                <span>Contact preference</span>
                <input name="contactPreference" value={form.contactPreference} onChange={handleChange} placeholder="Message me first, evenings are best" />
                <small>Use this to guide buyers before they reach out.</small>
              </label>
            </div>

            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>About you</span>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={4}
                placeholder="I’m a UNM student selling clean, ready-to-use items and I usually meet near campus."
              />
              <small>A short bio helps first-time buyers feel more comfortable.</small>
            </label>

            <div className={styles.actions}>
              <button type="submit" className={styles.saveButton} disabled={isSaving}>
                {isSaving ? "Saving profile..." : "Save profile"}
              </button>
              <a href={profile ? `/seller/${profile.id}` : "/listings"} className={styles.previewLink}>
                View public profile
              </a>
            </div>
          </form>

          <aside className={styles.previewPanel} aria-label="Public seller profile preview">
            <div className={styles.completionCard}>
              <div>
                <p className={styles.cardEyebrow}>Profile completion</p>
                <strong>{profileCompletion}% complete</strong>
                <p>Complete the basics buyers look for first: name, bio, meetup preference, and response time.</p>
              </div>
              <div className={styles.progressTrack} aria-hidden="true">
                <span style={{ width: `${profileCompletion}%` }} />
              </div>
            </div>

            <div className={styles.publicCard}>
              <p className={styles.cardEyebrow}>Public profile preview</p>
              <div className={styles.previewHeader}>
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={sellerName} className={styles.previewAvatar} />
                ) : (
                  <span className={styles.previewAvatarFallback}>{getInitial(profile, form)}</span>
                )}
                <div>
                  <h3>{sellerName}</h3>
                  <p>{form.campusAffiliation.trim() || "UNM student or local community seller"}</p>
                </div>
              </div>

              <p className={styles.previewBio}>
                {form.bio.trim() || "Add a short bio so first-time buyers know what you sell and where you like to meet."}
              </p>

              <div className={styles.pillRow}>
                {(previewPills.length > 0 ? previewPills : ["Public meetup details", "Response time", "Contact preference"]).map((pill) => (
                  <span key={pill} className={styles.infoPill}>
                    {pill}
                  </span>
                ))}
              </div>

              <div className={styles.previewBlock}>
                <h4>Seller interests</h4>
                <div className={styles.pillRow}>
                  {(interestList.length > 0 ? interestList : ["Textbooks", "Dorm setup", "Campus pickup"]).map((interest) => (
                    <span key={interest} className={styles.interestPill}>
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
