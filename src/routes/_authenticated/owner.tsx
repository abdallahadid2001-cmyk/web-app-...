import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner")({
  beforeLoad: ({ context }) => {
    if (context.role !== "owner") throw redirect({ to: "/seller" });
  },
  component: () => <Outlet />,
});
