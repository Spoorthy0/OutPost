"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

function timeOfDay(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// `name` is empty or ", Spoorthy", so each line also reads correctly for users without a first name.
function greetings(name: string) {
  return [
    `Hello${name}, what are we building?`,
    `${timeOfDay(new Date().getHours())}${name}`,
    `Welcome back${name}`,
    `What's on your mind${name}?`,
    `What are we planning today${name}?`,
    `Ready when you are${name}`,
    `Got a new idea${name}?`,
    `Where should we start${name}?`,
    `Back at it${name}. What's next?`,
    `Let's map something out${name}`,
  ];
}

// Mounted only once Clerk has loaded, which never happens on the server, so the random pick can't
// run during prerendering or cause a hydration mismatch. It stays fixed until the page is reopened.
function RandomGreeting({ firstName }: { firstName?: string | null }) {
  const [greeting] = useState(() => {
    const options = greetings(firstName ? `, ${firstName}` : "");
    return options[Math.floor(Math.random() * options.length)];
  });

  return <span className="animate-in duration-500 fade-in">{greeting}</span>;
}

export function DashboardGreeting() {
  const { isLoaded, user } = useUser();

  return (
    <h2 className="text-heading-fade text-4xl leading-tight font-semibold tracking-[-0.03em] text-balance md:text-5xl">
      {/* The non-breaking space holds the line's height so the page doesn't jump when the title appears. */}
      {isLoaded ? <RandomGreeting firstName={user?.firstName} /> : " "}
    </h2>
  );
}
