import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  route("api/auth/*", "routes/auth-api.ts"),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-up", "routes/sign-up.tsx"),
  layout("routes/app-layout.tsx", [
    index("routes/home.tsx"),
    route("profile", "routes/profile.tsx"),
    route("profile/experiences/:experienceId", "routes/experience-editor.tsx"),
    route("settings/api-key", "routes/api-key-settings.tsx"),
    route("analyses/:analysisId", "routes/analysis-result.tsx"),
    route("resumes/:resumeId", "routes/resume-editor.tsx"),
    route("resumes/:resumeId/pdf", "routes/resume-pdf.tsx"),
  ]),
] satisfies RouteConfig;
