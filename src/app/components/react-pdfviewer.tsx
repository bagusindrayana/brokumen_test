import { Document, Page, } from "react-pdf";
import { pdfjs } from "react-pdf";
import { SizeMe } from "react-sizeme";
import { useState,useCallback } from "react";
import { CustomTextRenderer } from "react-pdf/dist/cjs/shared/types";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function highlightPattern(text:string, pattern:string[]) {
    let textResult = text;
    pattern.forEach((value) => {
        textResult = textResult.replace(value, (r) => `<mark>${r}</mark>`);
    });
  return textResult;
}


export default function ReactPdfViewer({ fileBuffer,stringToHighlight }: { fileBuffer: ArrayBuffer,stringToHighlight:string[] }) {
    const [numPages, setNumPages] = useState(0);

    const textRenderer = useCallback(
        (textItem:any)  => highlightPattern(textItem.str, stringToHighlight),
        [stringToHighlight]
      );

    return (
        <SizeMe
            monitorHeight
            refreshRate={128}
            refreshMode={"debounce"}>
            {({ size }) => <Document file={fileBuffer} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
                {Array.apply(null, Array(numPages))
                    .map((x, i) => i + 1)
                    .map(page => <Page
                        customTextRenderer={textRenderer}
                        key={"page-"+page}
                        pageNumber={page}
                        width={size.width ? size.width : 758}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                    />)}
                
            </Document>}
        </SizeMe>

    );
}