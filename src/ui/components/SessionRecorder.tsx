"use client";

import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

// Inlined at build time. Undefined means recording is not configured, in which
// case this component does nothing: it must never fall back to a localhost URL,
// because "localhost" in a visitor's browser is that visitor's own machine.
const RRWEB_API_URL = process.env.NEXT_PUBLIC_RRWEB_API_URL;

export default function SessionRecorder() {
	const eventsRef = useRef<any[]>([]);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const sessionIdRef = useRef<string>("");

	useEffect(() => {
		if (!RRWEB_API_URL) return;

		let stopRecording: (() => void) | undefined;

		// 1. Get or Generate Session ID
		let sessionId = localStorage.getItem("rrweb_session_id");
		if (!sessionId) {
			sessionId = uuidv4();
			localStorage.setItem("rrweb_session_id", sessionId);
		}
		sessionIdRef.current = sessionId;

		// 2. Dynamically load rrweb and start recording
		import("rrweb")
			.then((rrweb) => {
				stopRecording = rrweb.record({
					emit(event) {
						eventsRef.current.push(event);
					},
				});
			})
			.catch((err) => {
				console.error("Failed to load rrweb", err);
			});

		// 3. Batch Upload Every 3 Seconds
		const apiUrl = RRWEB_API_URL;

		intervalRef.current = setInterval(() => {
			if (eventsRef.current.length > 0) {
				const payloadEvents = [...eventsRef.current];
				eventsRef.current = [];

				fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Site-ID": process.env.NEXT_PUBLIC_DEFAULT_CHANNEL || "default-channel",
					},
					body: JSON.stringify({
						session_id: sessionIdRef.current,
						domain: window.location.hostname,
						user_agent: navigator.userAgent,
						path: window.location.pathname,
						events: payloadEvents,
					}),
				}).catch((err) => {
					console.error("Failed to send rrweb events", err);
					// Re-queue events on failure
					eventsRef.current = [...payloadEvents, ...eventsRef.current];
				});
			}
		}, 3000);

		// 4. Flush remaining events on tab close/hide
		const flushEvents = () => {
			if (eventsRef.current.length > 0) {
				const payloadEvents = [...eventsRef.current];
				eventsRef.current = [];
				const blob = new Blob(
					[
						JSON.stringify({
							session_id: sessionIdRef.current,
							user_agent: navigator.userAgent,
							path: window.location.pathname,
							events: payloadEvents,
						}),
					],
					{ type: "application/json" },
				);
				navigator.sendBeacon(apiUrl, blob);
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				flushEvents();
			}
		};

		window.addEventListener("visibilitychange", handleVisibilityChange);

		// 5. Cleanup on Unmount
		return () => {
			if (stopRecording) stopRecording();
			if (intervalRef.current) clearInterval(intervalRef.current);
			window.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	return null;
}
