import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/seller")({
  beforeLoad: ({ context }) => {
    if (context.role === "owner") throw redirect({ to: "/owner" });
  },
  component: () => <Outlet />,
});
