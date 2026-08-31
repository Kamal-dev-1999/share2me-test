/**
 * TypeScript Data Models for Full-Featured PDF Editor
 */

export type ToolMode =
  | "select"
  | "text"
  | "edit-text"
  | "image"
  | "shape"
  | "draw"
  | "eraser"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "comment"
  | "signature"
  | "checkbox"
  | "whiteout";

export type ShapeType = "rectangle" | "rounded-rect" | "circle" | "ellipse" | "line" | "arrow";

export interface Point {
  x: number;
  y: number;
}

export interface BasePdfObject {
  id: string;
  type: string;
  pageIndex: number; // 0-indexed page number
  /** Left position as fraction of page width (0..1) */
  xFrac: number;
  /** Top position as fraction of page height (0..1) */
  yFrac: number;
  /** Width as fraction of page width (0..1) */
  wFrac: number;
  /** Height as fraction of page height (0..1) */
  hFrac: number;
  /** Rotation in degrees (0..360) */
  rotation: number;
  /** Opacity (0..1) */
  opacity: number;
  /** Stacking z-index order */
  zIndex: number;
}

export interface TextPdfObject extends BasePdfObject {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number; // In PDF points (e.g. 16)
  color: string; // Hex color string
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  isExistingText?: boolean;
  originalText?: string;
  /** Original bounding box as fractions (0..1) of page before any user moves */
  origXFrac?: number;
  origYFrac?: number;
  origWFrac?: number;
  origHFrac?: number;
  /** Flag for deleted existing text items that must be masked out on export */
  isDeleted?: boolean;
}

export interface ImagePdfObject extends BasePdfObject {
  type: "image";
  dataUrl: string;
  aspectRatio: number;
}

export interface ShapePdfObject extends BasePdfObject {
  type: "shape";
  shapeType: ShapeType;
  fillColor: string; // Hex or 'transparent'
  strokeColor: string; // Hex or 'transparent'
  strokeWidth: number; // In PDF points
}

export interface DrawingPdfObject extends BasePdfObject {
  type: "drawing";
  /** Points relative to the object's bounding box as fractions (0..1) */
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
}

export interface HighlightPdfObject extends BasePdfObject {
  type: "highlight";
  color: string;
}

export interface UnderlinePdfObject extends BasePdfObject {
  type: "underline";
  color: string;
  strokeWidth: number;
}

export interface StrikethroughPdfObject extends BasePdfObject {
  type: "strikethrough";
  color: string;
  strokeWidth: number;
}

export interface CommentPdfObject extends BasePdfObject {
  type: "comment";
  commentText: string;
  color: string;
}

export interface SignaturePdfObject extends BasePdfObject {
  type: "signature";
  dataUrl: string;
  aspectRatio: number;
}

export interface CheckboxPdfObject extends BasePdfObject {
  type: "checkbox";
  checked: boolean;
  color: string;
}

export interface WhiteoutPdfObject extends BasePdfObject {
  type: "whiteout";
}

export type PdfObject =
  | TextPdfObject
  | ImagePdfObject
  | ShapePdfObject
  | DrawingPdfObject
  | HighlightPdfObject
  | UnderlinePdfObject
  | StrikethroughPdfObject
  | CommentPdfObject
  | SignaturePdfObject
  | CheckboxPdfObject
  | WhiteoutPdfObject;

export interface PageState {
  pageIndex: number;
  rotation: number; // 0, 90, 180, 270 degrees
  isDeleted: boolean;
  isCustomBlank?: boolean;
}

export interface ExtractedTextItem {
  id: string;
  pageIndex: number;
  text: string;
  xFrac: number;
  yFrac: number;
  wFrac: number;
  hFrac: number;
  fontSize: number;
  fontName: string;
  color: string;
  /** Exact PDF point coordinates (0,0 bottom-left) */
  xPt?: number;
  yPt?: number;
  wPt?: number;
  hPt?: number;
  bold?: boolean;
  italic?: boolean;
}
