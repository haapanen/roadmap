# Text to Roadmap

A web-based tool that converts simple text descriptions into visual roadmap diagrams. Create professional Gantt-style roadmaps with support for swimlanes, customizable time periods, and export to SVG or draw.io format.

![Roadmap Example](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) ![Vite](https://img.shields.io/badge/Vite-latest-purple)

## Features

- **Text-based input** - Define roadmaps using a simple, readable text format
- **Arbitrary time periods** - Support for quarters (Q1, Q2), months, sprints, or any custom periods
- **Flexible positioning** - Define item positions using period names, lengths, or mathematical expressions
- **Swimlanes** - Group items by team, category, or any other criteria
- **Custom colors** - Set individual item colors or define a custom color palette
- **Export options**:
  - Download as SVG
  - Copy SVG to clipboard
  - Download as draw.io file
  - Copy draw.io XML for pasting into diagrams.net
- **Shareable URLs** - Generate links that include your roadmap data

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd roadmap

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

### Input Format

The roadmap is defined using a simple text format:

```markdown
# Roadmap Title (optional)

## Periods

Q1 2026, Q2 2026, Q3 2026, Q4 2026

## Team Name

- Item title | start: Q1 2026 | end: Q3 2026
- Another item | start: Q2 2026 | length: 2
- Third item | start: Q1 2026 | end: Q2 2026 | color: #FF5733
```

### Sections

#### Periods

Define your timeline using comma-separated values:

```markdown
## Periods

Q1, Q2, Q3, Q4
```

Or with more descriptive labels:

```markdown
## Periods

Jan 2026, Feb 2026, Mar 2026, Apr 2026
```

#### Swimlanes

Create swimlanes using any of these headers:

```markdown
## Team Name

## Swimlane: Team Name

## Team: Team Name

## Lane: Team Name
```

#### Items

Define items within swimlanes using the following format:

```markdown
- Item title | start: <period> | end: <period>
- Item title | start: <period> | length: <number>
- Item title | start: <period> | end: <period> | color: #hexcolor
```

### Position Expressions

Items support mathematical expressions for precise positioning:

```markdown
- Item | start: Q1 | end: Q3 # From Q1 to Q3
- Item | start: Q2 | length: 2 # Start at Q2, spans 2 periods
- Item | start: Q1+(Q2-Q1)/2 | end: Q4 # Start midway between Q1 and Q2
```

### Custom Colors

#### Per-item colors

```markdown
- Feature A | start: Q1 | end: Q2 | color: #4285F4
- Feature B | start: Q2 | end: Q3 | color: coral
```

#### Color palette

Enter colors in the palette field (comma or newline separated):

```
#4285F4, #EA4335, #FBBC04, #34A853
```

### Configuration Options

- **Period Width** - Adjust the width of each time period column (default: 150px)
- **Item Height** - Adjust the height of each item bar (default: 36px)
- **Color Palette** - Define custom colors for automatic item coloring

### URL Parameters

The app supports URL parameters for sharing and bookmarking:

| Parameter     | Description                    | Default |
| ------------- | ------------------------------ | ------- |
| `data`        | Base64-encoded roadmap text    | -       |
| `palette`     | Comma-separated color values   | -       |
| `periodWidth` | Width of each period in pixels | 150     |
| `itemHeight`  | Height of each item in pixels  | 36      |

### Example

```markdown
# Product Roadmap 2026

## Periods

Q1 2026, Q2 2026, Q3 2026, Q4 2026

## Frontend Team

- New Design System | start: Q1 2026 | end: Q2 2026 | color: #4285F4
- Dashboard Redesign | start: Q2 2026 | length: 2 | color: #EA4335
- Mobile App | start: Q3 2026 | end: Q4 2026 | color: #FBBC04

## Backend Team

- API v2 | start: Q1 2026 | end: Q3 2026 | color: #34A853
- Database Migration | start: Q2 2026 | length: 1 | color: #FF6D01
- Microservices | start: Q3 2026 | end: Q4 2026 | color: #46BDC6

## DevOps

- CI/CD Pipeline | start: Q1 2026 | length: 1 | color: #9E69AF
- Kubernetes Setup | start: Q2 2026 | end: Q4 2026 | color: #7BAAF7
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **pako** - Compression for draw.io export

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |
| `npm run lint`    | Run ESLint               |

## License

MIT
