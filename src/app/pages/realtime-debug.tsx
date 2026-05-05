"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLatestRealtimeDebugEvent, getListings, type Listing } from "./listings.data";
import { type NewListingEvent } from "./listings.realtime";
import styles from "./realtime-debug.module.css";

type SimulatedClientId = "client-a" | "client-b" | "client-c";
type DashboardStatus = "warning" | "healthy" | "error";

interface ClientState {
  clientId: SimulatedClientId;
  status: "connecting" | "connected" | "error";
  lastEventId: string | null;
  lastEventTimestamp: string | null;
  lastReceivedAt: string | null;
  lastOrderSignature: string;
  receivedCount: number;
  duplicateCount: number;
  error: string | null;
}

interface EventLogEntry {
  id: string;
  clientId: SimulatedClientId;
  eventId: string;
  occurredAt: string;
  receivedAt: string;
  duplicate: boolean;
  orderSignature: string;
}

const CLIENT_IDS: SimulatedClientId[] = ["client-a", "client-b", "client-c"];
const INITIAL_CLIENT_STATE: Record<SimulatedClientId, ClientState> = {
  "client-a": {
    clientId: "client-a",
    status: "connecting",
    lastEventId: null,
    lastEventTimestamp: null,
    lastReceivedAt: null,
    lastOrderSignature: "",
    receivedCount: 0,
    duplicateCount: 0,
    error: null,
  },
  "client-b": {
    clientId: "client-b",
    status: "connecting",
    lastEventId: null,
    lastEventTimestamp: null,
    lastReceivedAt: null,
    lastOrderSignature: "",
    receivedCount: 0,
    duplicateCount: 0,
    error: null,
  },
  "client-c": {
    clientId: "client-c",
    status: "connecting",
    lastEventId: null,
    lastEventTimestamp: null,
    lastReceivedAt: null,
    lastOrderSignature: "",
    receivedCount: 0,
    duplicateCount: 0,
    error: null,
  },
};

const getOrderSignature = (listings: Listing[]): string => {
  return listings.slice(0, 5).map((listing) => listing.id).join(" > ");
};

const CLIENT_POLL_INTERVALS: Record<SimulatedClientId, number> = {
  "client-a": 900,
  "client-b": 1100,
  "client-c": 1300,
};

const CheckIcon = () => (
  <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true">
    <path d="M7.8 13.7 4.2 10l1.4-1.4 2.2 2.2 6.6-6.6 1.4 1.4-8 8.1Z" />
  </svg>
);

const ErrorIcon = () => (
  <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true">
    <path d="m10 8.6 3.3-3.3 1.4 1.4-3.3 3.3 3.3 3.3-1.4 1.4-3.3-3.3-3.3 3.3-1.4-1.4L8.6 10 5.3 6.7l1.4-1.4L10 8.6Z" />
  </svg>
);

const WarningIcon = () => (
  <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 2.8 18 17H2L10 2.8Zm0 4.9c-.6 0-1 .4-1 1v3.4h2V8.7c0-.6-.4-1-1-1Zm0 7.1a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z" />
  </svg>
);

const StatusIcon = ({ status }: { status: DashboardStatus }) => {
  if (status === "healthy") {
    return <CheckIcon />;
  }

  if (status === "error") {
    return <ErrorIcon />;
  }

  return <WarningIcon />;
};

export const RealtimeDebug = () => {
  const [clientStates, setClientStates] = useState<Record<SimulatedClientId, ClientState>>(INITIAL_CLIENT_STATE);
  const [eventLogs, setEventLogs] = useState<EventLogEntry[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const processedEventIdsRef = useRef<Record<SimulatedClientId, Set<string>>>({
    "client-a": new Set(),
    "client-b": new Set(),
    "client-c": new Set(),
  });
  const pollTimersRef = useRef<number[]>([]);

  useEffect(() => {
    let disposed = false;

    const pollClient = async (clientId: SimulatedClientId) => {
      try {
        console.info("[realtime:simulated-client] fetch latest event", {
          clientId,
          method: "GET",
          url: "/api/dev/realtime-event",
        });

        const { event } = await fetchLatestRealtimeDebugEvent();
        if (!event) {
          if (!disposed) {
            setClientStates((current) => ({
              ...current,
              [clientId]: {
                ...current[clientId],
                status: "connected",
                error: null,
              },
            }));
          }
          return;
        }

        if (!processedEventIdsRef.current[clientId].has(event.eventId)) {
          const receivedAt = new Date().toISOString();
          processedEventIdsRef.current[clientId].add(event.eventId);

          let orderSignature = "Unable to load listings";
          try {
            const listings = await getListings();
            orderSignature = getOrderSignature(listings);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load listings for ordering";
            console.error("[realtime:simulated-client] listings fetch failed", {
              clientId,
              eventId: event.eventId,
              message,
            });
            if (!disposed) {
              setPageError(message);
            }
          }

          console.info("[realtime:simulated-client] event received", {
            clientId,
            eventId: event.eventId,
            occurredAt: event.occurredAt,
            receivedAt,
            duplicate: false,
            orderSignature,
          });

          if (disposed) {
            return;
          }

          setClientStates((current) => ({
            ...current,
            [clientId]: {
              ...current[clientId],
              status: "connected",
              lastEventId: event.eventId,
              lastEventTimestamp: event.occurredAt,
              lastReceivedAt: receivedAt,
              lastOrderSignature: orderSignature,
              receivedCount: current[clientId].receivedCount + 1,
              duplicateCount: current[clientId].duplicateCount,
              error: null,
            },
          }));

          setEventLogs((current) => [
            {
              id: `${clientId}-${event.eventId}-${receivedAt}`,
              clientId,
              eventId: event.eventId,
              occurredAt: event.occurredAt,
              receivedAt,
              duplicate: false,
              orderSignature,
            },
            ...current,
          ].slice(0, 60));
        } else if (!disposed) {
          setClientStates((current) => ({
            ...current,
            [clientId]: {
              ...current[clientId],
              status: "connected",
              error: null,
            },
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to poll realtime event";
        console.error("[realtime:simulated-client] poll failed", { clientId, error });
        if (!disposed) {
          setPageError(message);
          setClientStates((current) => ({
            ...current,
            [clientId]: {
              ...current[clientId],
              status: "error",
              error: message,
            },
          }));
        }
      }
    };

    for (const clientId of CLIENT_IDS) {
      void pollClient(clientId);
      const intervalId = window.setInterval(() => {
        void pollClient(clientId);
      }, CLIENT_POLL_INTERVALS[clientId]);
      pollTimersRef.current.push(intervalId);
    }

    return () => {
      disposed = true;
      for (const intervalId of pollTimersRef.current) {
        window.clearInterval(intervalId);
      }
      pollTimersRef.current = [];
    };
  }, []);

  const handlePostTestListing = async () => {
    setIsPosting(true);
    setPageError(null);

    try {
      console.info("[realtime:simulated-client] post test listing", {
        method: "POST",
        url: "/api/dev/realtime-event",
      });

      const response = await fetch("/api/dev/realtime-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          title: "Test item",
          price: 10,
          description: "Realtime test",
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error("[realtime:simulated-client] debug post failed", {
          status: response.status,
          body: responseText,
        });
        try {
          const parsed = JSON.parse(responseText) as { error?: string };
          throw new Error(parsed.error || `HTTP ${response.status}`);
        } catch {
          throw new Error(responseText || `HTTP ${response.status}`);
        }
      }

      console.info("[realtime:simulated-client] debug post response", {
        status: response.status,
        body: responseText,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post test listing";
      console.error("[realtime:simulated-client] post test listing failed", { error });
      setPageError(message);
    } finally {
      setIsPosting(false);
    }
  };

  const orderingConsistent = useMemo(() => {
    const signatures = Object.values(clientStates)
      .map((state) => state.lastOrderSignature)
      .filter((signature) => signature.length > 0);

    if (signatures.length < 2) {
      return true;
    }

    return signatures.every((signature) => signature === signatures[0]);
  }, [clientStates]);

  const orderingSignaturesReady = useMemo(() => {
    return Object.values(clientStates).every((state) => state.lastOrderSignature.length > 0);
  }, [clientStates]);

  const duplicateEventsDetected = useMemo(() => {
    return Object.values(clientStates).some((state) => state.duplicateCount > 0);
  }, [clientStates]);

  const totalDuplicateEvents = useMemo(() => {
    return Object.values(clientStates).reduce((total, state) => total + state.duplicateCount, 0);
  }, [clientStates]);

  const allClientsConnected = useMemo(() => {
    return Object.values(clientStates).every((state) => state.status === "connected");
  }, [clientStates]);

  const hasClientError = useMemo(() => {
    return Object.values(clientStates).some((state) => state.status === "error" || state.error);
  }, [clientStates]);

  const hasRunTest = eventLogs.length > 0;
  const isHealthy =
    allClientsConnected && totalDuplicateEvents === 0 && orderingConsistent && orderingSignaturesReady && !pageError && !hasClientError;
  const dashboardStatus: DashboardStatus = !hasRunTest
    ? "warning"
    : isHealthy
      ? "healthy"
      : "error";
  const statusLabel =
    dashboardStatus === "healthy" ? "Realtime System Healthy" : dashboardStatus === "warning" ? "Warning" : "Error";
  const summaryStatus = dashboardStatus === "healthy" ? "Healthy" : dashboardStatus === "warning" ? "Warning" : "Error";
  const bannerClassName =
    dashboardStatus === "healthy"
      ? styles.healthyBanner
      : dashboardStatus === "warning"
        ? styles.warningBanner
        : styles.errorStatusBanner;
  const summaryStatusClassName =
    dashboardStatus === "healthy"
      ? styles.healthyText
      : dashboardStatus === "warning"
        ? styles.warningText
        : styles.errorStatusText;

  return (
    <div className={styles.page}>
      <section className={`${styles.statusBanner} ${bannerClassName}`} aria-live="polite">
        <div className={styles.statusBannerIcon}>
          <StatusIcon status={dashboardStatus} />
        </div>
        <div>
          <p className={styles.statusEyebrow}>Realtime verifier status</p>
          <h2>{statusLabel}</h2>
          <p>
            {dashboardStatus === "healthy"
              ? "All clients are connected, no duplicates were detected, and ordering signatures match."
              : dashboardStatus === "warning"
                ? "No test has been run yet. Run the realtime test to verify fan-out and ordering."
                : "A realtime verification check is failing. Review the client cards and event log below."}
          </p>
        </div>
      </section>

      <header className={styles.header}>
        <div>
          <h1>Realtime Verifier</h1>
          <p className={styles.subtitle}>
            Simulates three clients connected to the listings realtime room and logs every event with ordering checks.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={orderingConsistent ? styles.goodBadge : styles.badBadge}>
            {orderingConsistent ? <CheckIcon /> : <ErrorIcon />}
            {orderingConsistent ? "Ordering consistent" : "Ordering mismatch detected"}
          </span>
          <span className={duplicateEventsDetected ? styles.badBadge : styles.goodBadge}>
            {duplicateEventsDetected ? <ErrorIcon /> : <CheckIcon />}
            {duplicateEventsDetected ? "Duplicate event detected" : "No duplicate events"}
          </span>
          <button type="button" className={styles.actionButton} onClick={handlePostTestListing} disabled={isPosting}>
            {isPosting ? "Running realtime test..." : "Run realtime test"}
          </button>
        </div>
      </header>

      {pageError ? <div className={styles.errorBanner}>{pageError}</div> : null}

      <section className={styles.summaryGrid} aria-label="Realtime summary">
        <div className={styles.summaryItem}>
          <span>Total clients</span>
          <strong>{CLIENT_IDS.length}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Events received</span>
          <strong>{eventLogs.length}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Duplicate events</span>
          <strong>{totalDuplicateEvents}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Status</span>
          <strong className={summaryStatusClassName}>{summaryStatus}</strong>
        </div>
      </section>

      <section className={styles.clientGrid} aria-label="Simulated clients">
        {CLIENT_IDS.map((clientId) => {
          const state = clientStates[clientId];

          return (
            <article key={clientId} className={styles.clientCard}>
              <div className={styles.clientHeader}>
                <h2>{clientId}</h2>
                <span
                  className={
                    state.status === "connected"
                      ? styles.statusConnected
                      : state.status === "error"
                        ? styles.statusError
                        : styles.statusConnecting
                  }
                >
                  {state.status}
                </span>
              </div>
              <dl className={styles.detailList}>
                <div>
                  <dt>Last event ID</dt>
                  <dd>{state.lastEventId ?? "None yet"}</dd>
                </div>
                <div>
                  <dt>Event timestamp</dt>
                  <dd>{state.lastEventTimestamp ?? "None yet"}</dd>
                </div>
                <div>
                  <dt>Received at</dt>
                  <dd>{state.lastReceivedAt ?? "None yet"}</dd>
                </div>
                <div>
                  <dt>Received count</dt>
                  <dd>{state.receivedCount}</dd>
                </div>
                <div>
                  <dt>Duplicate count</dt>
                  <dd>{state.duplicateCount}</dd>
                </div>
                <div>
                  <dt>Top ordering</dt>
                  <dd>{state.lastOrderSignature || "Waiting for listings..."}</dd>
                </div>
              </dl>
              {state.error ? <p className={styles.errorText}>{state.error}</p> : null}
            </article>
          );
        })}
      </section>

      <section className={styles.logSection} aria-label="Event log">
        <div className={styles.sectionHeader}>
          <h2>Event Log</h2>
          <p>Each client logs `eventId`, source timestamp, receipt timestamp, duplicate status, and its local top-5 ordering signature.</p>
        </div>
        {eventLogs.length === 0 ? (
          <p className={styles.emptyState}>No realtime events received yet. Post a test listing to verify fan-out.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Event ID</th>
                  <th>Occurred</th>
                  <th>Received</th>
                  <th>Duplicate</th>
                  <th>Order signature</th>
                </tr>
              </thead>
              <tbody>
                {eventLogs.map((entry) => (
                  <tr key={entry.id} className={entry.id === eventLogs[0]?.id ? styles.newEventRow : undefined}>
                    <td>{entry.clientId}</td>
                    <td>{entry.eventId}</td>
                    <td>{entry.occurredAt}</td>
                    <td>{entry.receivedAt}</td>
                    <td>{entry.duplicate ? "yes" : "no"}</td>
                    <td>{entry.orderSignature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
