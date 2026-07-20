import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ResumeContent } from "../lib/resume";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#111827",
    lineHeight: 1.35,
  },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  title: { marginTop: 3, fontSize: 11, color: "#374151" },
  contact: { marginTop: 6, fontSize: 8.5, color: "#4b5563" },
  section: { marginTop: 14 },
  heading: {
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
    paddingBottom: 3,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  paragraph: { marginTop: 6 },
  role: { marginTop: 8 },
  roleHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roleTitle: { fontFamily: "Helvetica-Bold" },
  dates: { color: "#4b5563" },
  bullet: { marginTop: 3, paddingLeft: 10 },
});

function displayDate(value: string | null, isCurrent = false): string {
  if (isCurrent) return "Present";
  if (!value) return "";
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

export function ResumePdfDocument({ content }: { content: ResumeContent }) {
  const contact = [
    content.contact.email,
    content.contact.phone,
    content.contact.location,
    content.contact.website,
    content.contact.linkedin,
  ].filter(Boolean);

  return (
    <Document
      title={`${content.contact.fullName} - ${content.targetTitle}`}
      author={content.contact.fullName}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{content.contact.fullName}</Text>
        <Text style={styles.title}>{content.targetTitle}</Text>
        <Text style={styles.contact}>{contact.join("  |  ")}</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Professional Summary</Text>
          <Text style={styles.paragraph}>{content.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Skills</Text>
          <Text style={styles.paragraph}>{content.skills.join("  •  ")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Experience</Text>
          {content.experiences.map((experience) => (
            <View
              key={experience.experienceId}
              style={styles.role}
              wrap={false}
            >
              <View style={styles.roleHeader}>
                <Text style={styles.roleTitle}>
                  {experience.position} | {experience.company}
                </Text>
                <Text style={styles.dates}>
                  {displayDate(experience.startDate)} –{" "}
                  {displayDate(experience.endDate, experience.isCurrent)}
                </Text>
              </View>
              {experience.bullets.map((bullet) => (
                <Text
                  key={`${bullet.sourceExperienceIds.join(":")}:${bullet.text}`}
                  style={styles.bullet}
                >
                  • {bullet.text}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
