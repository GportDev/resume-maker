import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type {
  CoverLetterContent,
  CoverLetterSender,
} from "../lib/cover-letter";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 54,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#111827",
    lineHeight: 1.45,
  },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  contact: { marginTop: 6, fontSize: 8.5, color: "#4b5563" },
  date: { marginTop: 24 },
  recipient: { marginTop: 18 },
  paragraph: { marginTop: 10 },
  signature: { marginTop: 18, fontFamily: "Helvetica-Bold" },
});

export function CoverLetterPdfDocument({
  content,
  sender,
  date,
  title,
}: {
  content: CoverLetterContent;
  sender: CoverLetterSender;
  date: string;
  title: string;
}) {
  const contact = [sender.email, sender.phone, sender.location].filter(Boolean);

  return (
    <Document title={title} author={sender.fullName}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{sender.fullName}</Text>
        {contact.length ? (
          <Text style={styles.contact}>{contact.join("  |  ")}</Text>
        ) : null}
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.recipient}>{content.recipient}</Text>
        <Text style={styles.paragraph}>{content.opening}</Text>
        {content.bodyParagraphs.map((paragraph) => (
          <Text
            key={`${paragraph.sourceExperienceIds.join(":")}:${paragraph.text}`}
            style={styles.paragraph}
          >
            {paragraph.text}
          </Text>
        ))}
        <View wrap={false}>
          <Text style={styles.paragraph}>{content.closing}</Text>
          <Text style={styles.signature}>{sender.fullName}</Text>
        </View>
      </Page>
    </Document>
  );
}
