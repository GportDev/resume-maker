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
  route(
    "contributions/:experienceId/download",
    "routes/contribution-download.ts",
  ),
  layout("routes/app-layout.tsx", [
    index("routes/home.tsx"),
    route("profile", "routes/profile.tsx"),
    route("profile/experiences/:experienceId", "routes/experience-editor.tsx"),
    route("contributions", "routes/contributions.tsx", [
      index("routes/contributions-index.tsx"),
      route("companies/:companyId", "routes/contribution-company.tsx"),
      route(":experienceId", "routes/contribution-file.tsx"),
    ]),
    route("applications", "routes/applications-board.tsx"),
    route("applications/:applicationId", "routes/application-detail.tsx"),
    route(
      "applications/:applicationId/tailor",
      "routes/application-tailor.tsx",
    ),
    route("settings/ai", "routes/ai-settings.tsx"),
    route("settings/api-key", "routes/api-key-settings.tsx"),
    route("analyses/:analysisId", "routes/analysis-result.tsx"),
    route("resumes/:resumeId", "routes/resume-editor.tsx"),
    route("resumes/:resumeId/pdf", "routes/resume-pdf.tsx"),
  ]),
] satisfies RouteConfig;
