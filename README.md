# EU-Pestizidzulassungen

Sammlung an Skripten um die Unabhängigkeit des Pestizidzulassungsverfahrens auf EU-Ebene zu untersuchen. Analysiert werden die Risikobewertungen der Mitgliedsstaaten auf textliche Übernahmen aus den Anträgen der Agrarunternehmen und Interessenverbände. Wie schon beim Unkrautvernichter Glyphosat gibt bei den meisten Abschlussberichten viele direkte Übernahmen aus den Herstelleranträgen ohne Quellenangabe.

- **Artikel**:

## Verwendung

1. Repository klonen `git clone https://...`
2. Erforderliche Module installieren `npm install`
3. Zum Beispiel `node extract.js` ausführen, um ein Skript zu starten.

## Voraussetzungen

Um die PDF-Dateien in ein Textformat umzuwandeln kommt die Node.js-Bibliothek [pdf-text-extract](https://github.com/nisaacson/pdf-text-extract) zum Einsatz. Diese benötigt folgende Softwarepakete:

- **PDFtk**: Installer [herunterladen](http://www.pdflabs.com/docs/install-pdftk/) und ausführen
- **Poppler** (pdftotext): `brew install poppler`
- **Ghostscript**: `brew install gs`
- **Tesseract**: `brew install tesseract`

Auf den meisten Linux-System können diese Abhängigkeiten mit `apt-get install` oder `rpm -i` installiert werden.

## Workflow

1. Manifest anlegen, um Berichte den jeweiligen Anträgen zuzuordnen
2. PDFs in ein semi-strukturiertes Datenformat umwandeln (`extract.js`)
3. Einzelne Seiten in Sätze zerlegen (`tokenize.js`)
4. Ähnlichkeitssuche starten (`compare.js`)
5. Map der Gesetzestexte erstellen (`mapify.js`)
6. Ergebnisse ansehen und überprüfen (`/view`)
7. Visualisierung der Textübernahmen ansehen (`/chart`)

## Daten

Grundsätzlich werden alle Dokumente, welche untersucht werden sollen, im Ordner `/input/{mein-projekt}` abgelegt. Die Analyseergebnisse werden dann automatisch im Ordner `/output/{mein-projekt}` gespeichert.

Die Daten im Verzeichnis `input/{mein-projekt}` sind folgendermaßen strukturiert:

- `manifest.json`: Zuordnung der einzelnen Dokumente zum jeweiligen legislativen Prozess (Manifest = Ladungsverzeichnis bei Schiffen)
- `/pdf`: Gesetze, Stellungnahmen (und Referentenentwürfe) im Original (PDFs)
- `/text`: Gesetze, Stellungnahmen (und Referentenentwürfe) als Text (extrahiert aus den PDFs)

Hier ein Beispiel für ein minimales Manifest, in dem ein EU-Gutachten zum Pestizid Lambda-C mit drei Stellungnahmen verschiedener Hersteller verglichen wird:

```javascript
[
  {
    "substance": "Lambda-C",
    "overview": "",
    "reports": [
      {
        "title": "Lambda-C Peer Review Report (Sweden)",
        "filename": "Lambda-C_B.pdf",
      }
    ],
    "applications": [
      {
        "title": "Task Force Lambda",
        "filename": "Lambda-C-TFL_A.pdf"
      },
      {
        "title": "Nufarm",
        "filename": "Lambda-C-Nufarm_A.pdf"
      },
      {
        "title": "Syngenta",
        "filename": "Lambda-C-Syngenta_A.pdf"
      }
    ]
  }
]
```

Das vollständige Manifest findet sich hier: [input/manifest.json](input/manifest.json).


## Daten säubern

```regex
^\s{2}.*?\\n\\n\\n
```

```regex
[.]{5,}
```


