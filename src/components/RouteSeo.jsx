import { useLocation } from "react-router-dom";
import Seo from "./Seo";

const PUBLIC_APP_SCHEMA = (url) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TapTime",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url,
  description:
    "TapTime is a web application for attendance tracking, employee sign-in, and shift management.",
});

const ROUTE_METADATA = {
  "/login": {
    title: "TapTime Login | Attendance and Shift Management",
    description:
      "Sign in to TapTime to access employee attendance tracking, shift workflows, and team account tools.",
    robots: "index, follow",
    canonicalPath: "/login",
    structuredData: (url) => PUBLIC_APP_SCHEMA(url),
  },
  "/signup": {
    title: "TapTime Sign Up | Employee Account Registration",
    description:
      "Create your TapTime employee account and complete setup with your employer invite code.",
    robots: "index, follow",
    canonicalPath: "/signup",
    structuredData: (url) => PUBLIC_APP_SCHEMA(url),
  },
  "/admin/dashboard": {
    title: "TapTime Admin Dashboard",
    description: "Private TapTime admin dashboard.",
    robots: "noindex, nofollow",
    canonicalPath: "/admin/dashboard",
  },
  "/user/dashboard": {
    title: "TapTime User Dashboard",
    description: "Private TapTime employee dashboard.",
    robots: "noindex, nofollow",
    canonicalPath: "/user/dashboard",
  },
  "/system-admin/dashboard": {
    title: "TapTime System Admin Dashboard",
    description: "Private TapTime system administration dashboard.",
    robots: "noindex, nofollow",
    canonicalPath: "/system-admin/dashboard",
  },
};

export default function RouteSeo() {
  const location = useLocation();
  const metadata = ROUTE_METADATA[location.pathname] ?? {
    title: "TapTime | Attendance and Shift Management",
    description:
      "TapTime helps teams manage attendance, employee sign-in, and shift operations from one streamlined web app.",
    robots: "noindex, nofollow",
    canonicalPath: location.pathname,
  };
  const canonicalUrl = new URL(metadata.canonicalPath, window.location.origin).toString();

  return (
    <Seo
      title={metadata.title}
      description={metadata.description}
      robots={metadata.robots}
      canonicalPath={metadata.canonicalPath}
      structuredData={metadata.structuredData?.(canonicalUrl)}
    />
  );
}
