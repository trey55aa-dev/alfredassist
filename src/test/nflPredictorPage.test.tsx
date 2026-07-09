import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NFLPredictor from "@/pages/NFLPredictor";

/** Minimal ESPN payloads: one final game + one upcoming game in week 15. */

const team = (id: string, abbr: string, name: string) => ({
  id,
  abbreviation: abbr,
  displayName: name,
  shortName: name.split(" ").pop(),
});

const scoreboard = {
  season: { year: 2025 },
  week: { number: 15 },
  events: [
    {
      id: "final1",
      date: "2025-12-12T01:15:00Z",
      name: "Las Vegas Raiders at Kansas City Chiefs",
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          competitors: [
            {
              homeAway: "home",
              score: "27",
              records: [{ type: "total", summary: "11-3" }],
              team: team("12", "KC", "Kansas City Chiefs"),
            },
            {
              homeAway: "away",
              score: "17",
              records: [{ type: "total", summary: "5-9" }],
              team: team("13", "LV", "Las Vegas Raiders"),
            },
          ],
        },
      ],
    },
    {
      id: "pre1",
      date: "2025-12-14T18:00:00Z",
      name: "Buffalo Bills at Miami Dolphins",
      competitions: [
        {
          status: { type: { state: "pre", completed: false, shortDetail: "Sun 1:00 PM" } },
          broadcasts: [{ names: ["CBS"] }],
          competitors: [
            {
              homeAway: "home",
              records: [{ type: "total", summary: "7-7" }],
              team: team("15", "MIA", "Miami Dolphins"),
            },
            {
              homeAway: "away",
              records: [{ type: "total", summary: "10-4" }],
              team: team("2", "BUF", "Buffalo Bills"),
            },
          ],
        },
      ],
    },
  ],
};

const standingsEntry = (id: string, wins: number, losses: number, pf: number, pa: number) => ({
  team: { id },
  stats: [
    { name: "wins", value: wins },
    { name: "losses", value: losses },
    { name: "ties", value: 0 },
    { name: "pointsFor", value: pf },
    { name: "pointsAgainst", value: pa },
    { name: "streak", value: 1 },
    { name: "Home", displayValue: "4-3" },
    { name: "Road", displayValue: "4-3" },
  ],
});

const standings = {
  children: [
    {
      standings: {
        entries: [
          standingsEntry("12", 11, 3, 380, 290),
          standingsEntry("13", 5, 9, 280, 360),
          standingsEntry("15", 7, 7, 320, 330),
          standingsEntry("2", 10, 4, 400, 300),
        ],
      },
    },
  ],
};

function mountPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NFLPredictor />
    </QueryClientProvider>,
  );
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes("standings") ? standings : scoreboard),
    })),
  );
});

describe("NFLPredictor page", () => {
  it("renders the week's games grouped by day with picks", async () => {
    mountPage();
    expect(await screen.findByText("Week 15")).toBeInTheDocument();
    expect((await screen.findAllByText("Chiefs")).length).toBeGreaterThan(0);
    expect(screen.getByText("Dolphins")).toBeInTheDocument();
    // Model favors Bills (10-4, +100 pd) over Dolphins at home → away pick shown
    const pickLabels = screen.getAllByText("Pick");
    expect(pickLabels).toHaveLength(2);
  });

  it("grades the final game and shows the all-time record", async () => {
    mountPage();
    // KC 11-3 favored at home over LV 5-9; final KC 27-17 → hit
    expect(await screen.findByText("Hit")).toBeInTheDocument();
    expect(screen.getByText("All-time")).toBeInTheDocument();
    expect(screen.getByText("1–0")).toBeInTheDocument();
    // Grade is persisted
    const stored = JSON.parse(localStorage.getItem("alfred.nfl.gameInputs") ?? "{}");
    expect(stored.final1.graded.correct).toBe(true);
  });

  it("opens 'Your read' and assigns an environment tag to the home side", async () => {
    mountPage();
    await screen.findAllByText("Chiefs");
    fireEvent.click(screen.getAllByText("Your read")[1]); // upcoming game
    const weather = await screen.findByText("Weather");
    fireEvent.click(weather);
    expect(screen.getByText("Weather → MIA")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("alfred.nfl.gameInputs") ?? "{}");
    expect(stored.pre1.tags.Weather).toBe("home");
  });

  it("shows the factor breakdown when a game is expanded", async () => {
    mountPage();
    await screen.findAllByText("Chiefs");
    fireEvent.click(screen.getAllByText("Your read")[0]);
    expect(await screen.findByText("Factor breakdown")).toBeInTheDocument();
    expect(screen.getByText("Scoring margin")).toBeInTheDocument();
    expect(screen.getByText("Your reasoning")).toBeInTheDocument();
  });
});
