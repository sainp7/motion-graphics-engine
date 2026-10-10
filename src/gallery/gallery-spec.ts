import type { VideoSpecInput } from "../spec/schema";

/**
 * The design-system gallery: one short segment per scene type and choreography, about load
 * balancing. Rendered in both themes (gallery-dark, gallery-light) as the visual reference for
 * what good looks like, and as a regression check after changing tokens or components.
 */
export const GALLERY_SPEC: VideoSpecInput = {
  version: 1,
  id: "gallery",
  title: "Design system gallery",
  voice: { engine: "estimate" },
  music: { track: null },
  lines: {
    requests: { color: "blue", label: "Requests" },
    health: { color: "green", label: "Health checks" },
  },
  diagrams: {
    lb: {
      nodes: [
        { id: "users", kind: "users", label: "Users", at: [2.2, 4.5] },
        { id: "lb", kind: "lb", label: "Load balancer", sub: "Layer 7, nginx", at: [6.4, 4.5] },
        { id: "a", kind: "server", label: "Server A", at: [11.6, 2.3] },
        { id: "b", kind: "server", label: "Server B", at: [11.6, 4.5] },
        { id: "c", kind: "server", label: "Server C", at: [11.6, 6.7] },
      ],
      edges: [
        { from: "users", to: "lb" },
        { from: "lb", to: "a" },
        { from: "lb", to: "b" },
        { from: "lb", to: "c" },
      ],
      groups: [{ id: "pool", label: "Server pool", nodes: ["a", "b", "c"] }],
    },
  },
  thumbnail: { lines: ["One server.", "{Ten thousand|red} users."] },
  segments: [
    {
      id: "hook",
      choreo: "cold-open",
      beats: [{ say: "You have one server. [pause 0.3] And ten thousand people just clicked the same link." }],
      scene: { type: "statement", lines: ["One server.", "{Ten thousand|red} users."], underline: "orange" },
    },
    {
      id: "number",
      choreo: "big-number",
      beats: [{ say: "That is ten thousand requests every second, and one server handles about two thousand." }],
      scene: {
        type: "stat",
        value: 10000,
        suffix: "req/s",
        label: "arriving at {one server}",
        bars: [
          { label: "What one server handles", value: 2000, line: "green" },
          { label: "What arrives", value: 10000, line: "red" },
        ],
      },
    },
    {
      id: "ch1",
      choreo: "chapter",
      chapter: "Spread the load",
      beats: [{ say: "So we spread the load." }],
      scene: { type: "chapter", number: 1, title: "Spread the load", subtitle: "One address, many servers" },
    },
    {
      id: "build",
      choreo: "build",
      beats: [
        { say: "Users talk to a single {load balancer|c-lb}." },
        { say: "Behind it sits a {pool|c-pool} of identical servers." },
      ],
      scene: {
        type: "diagram",
        diagram: "lb",
        title: "Load balancing",
        actions: [
          { at: "start", do: "show", targets: ["users"] },
          { at: "c-lb", do: "show", targets: ["lb"] },
          { at: "c-pool", do: "show", targets: ["a", "b", "c"] },
        ],
      },
    },
    {
      id: "flow",
      choreo: "flow",
      beats: [{ say: "Each new request goes to the {next|c-1} server in turn, {then the next|c-2}, {then the next|c-3}." }],
      scene: {
        type: "diagram",
        diagram: "lb",
        actions: [
          { at: "c-1", do: "flow", path: ["users", "lb", "a"], line: "requests", label: "GET /feed" },
          { at: "c-2", do: "flow", path: ["users", "lb", "b"], line: "requests" },
          { at: "c-3", do: "flow", path: ["users", "lb", "c"], line: "requests" },
        ],
      },
    },
    {
      id: "fail",
      choreo: "failure",
      beats: [
        { say: "Then {server B dies|c-die}." },
        { say: "Health checks {notice|c-hc}, and traffic {routes around it|c-route}." },
      ],
      scene: {
        type: "diagram",
        diagram: "lb",
        actions: [
          { at: "c-die", do: "fail", targets: ["b"] },
          { at: "c-die+0.2", do: "badge", target: "b", text: "DOWN", line: "red" },
          { at: "c-hc", do: "flow", path: ["lb", "a"], line: "health", persist: false },
          { at: "c-hc", do: "flow", path: ["lb", "c"], line: "health", persist: false },
          { at: "c-route", do: "dim", targets: ["lb-b"] },
          { at: "c-route", do: "flow", path: ["users", "lb", "c"], line: "requests", packets: 3 },
        ],
      },
    },
    {
      id: "seq",
      choreo: "deep-dive",
      beats: [{ say: "Every few seconds the balancer {asks|c-ask} each server if it is healthy, and {waits|c-wait} for a reply." }],
      scene: {
        type: "sequence",
        title: "Health check",
        actors: [
          { id: "lb", label: "Load balancer", kind: "lb" },
          { id: "a", label: "Server A", kind: "server" },
          { id: "b", label: "Server B", kind: "server" },
        ],
        messages: [
          { from: "lb", to: "a", label: "GET /healthz", code: true, at: "c-ask" },
          { from: "a", to: "lb", label: "200 OK", code: true, style: "dashed", line: "green", at: "c-ask+0.6" },
          { from: "lb", to: "b", label: "GET /healthz", code: true, at: "c-wait" },
          { from: "b", to: "lb", label: "timeout", style: "dashed", line: "red", at: "c-wait+0.8", badge: { text: "REMOVED", line: "red" } },
        ],
      },
    },
    {
      id: "cmp",
      choreo: "compare",
      beats: [
        { say: "Round robin is simple and fair when requests are alike." },
        { say: "Least connections adapts when some requests are slow." },
        { say: "{Start with least connections|c-v} if your work is uneven." },
      ],
      scene: {
        type: "compare",
        left: {
          title: "Round robin",
          line: "blue",
          items: [
            { text: "Simple to reason about", verdict: "pro" },
            { text: "Ignores slow requests", verdict: "con" },
          ],
        },
        right: {
          title: "Least connections",
          line: "violet",
          items: [
            { text: "Adapts to real load", verdict: "pro" },
            { text: "Needs connection tracking", verdict: "neutral" },
          ],
        },
        verdict: { side: "right", text: "Uneven work? Use this", at: "c-v" },
      },
    },
    {
      id: "code",
      choreo: "deep-dive",
      beats: [{ say: "In nginx this is a few lines: a pool of servers, and {one line|c-lc} to switch the strategy." }],
      scene: {
        type: "code",
        title: "nginx.conf",
        lines: ["upstream app {", "  least_conn;", "  server 10.0.0.1;", "  server 10.0.0.2;", "  server 10.0.0.3;", "}"],
        actions: [{ at: "c-lc", do: "highlight", lines: [2, 2], line: "violet" }],
      },
    },
    {
      id: "insight",
      choreo: "insight",
      beats: [{ say: "The balancer is not the clever part. [pause 0.4] The health checks are." }],
      scene: { type: "statement", lines: ["Health checks are", "the {real feature|green}."] },
    },
    {
      id: "recap",
      choreo: "recap",
      beats: [
        { say: "One address in front." },
        { say: "Many identical servers behind." },
        { say: "Health checks to route around failure." },
      ],
      scene: {
        type: "list",
        title: "Remember",
        items: [
          { text: "One address in front" },
          { text: "Identical servers behind", detail: "Any of them can answer any request" },
          { text: "Health checks route around failure" },
        ],
      },
    },
    {
      id: "outro",
      choreo: "outro",
      beats: [{ say: "That is how one link survives ten thousand clicks." }, { say: "Follow for more system design." }],
      scene: { type: "outro", text: "One link, {ten thousand clicks}, zero drama.", handle: "@sainp7", next: "Caching, and the stampede that breaks it" },
    },
  ],
};
