const PDFDocument = require('pdfkit');
const { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType } = require('docx');

class DocumentGenerator {
  // Generate PDF
  static async generatePDF(quote, stream) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      rtl: true // Enable RTL for Hebrew
    });

    doc.pipe(stream);

    // Add logo if exists
    if (quote.company?.logoData) {
        doc.image(
          quote.company.logoData,
          50,
          50,
          {
            fit: [150, 100],
            align: 'right'
          }
        );
        doc.moveDown(4); // Space after logo
      }



    // Add company info
    doc.fontSize(20).text('הצעת מחיר', { align: 'right' });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`מספר: ${quote.number}`, { align: 'right' });
    doc.text(`תאריך: ${new Date().toLocaleDateString('he-IL')}`, { align: 'right' });
    doc.moveDown();

    // Add items table
    const tableTop = 200;
    doc.fontSize(10);

    // Table headers
    const headers = ['סה״כ', 'הנחה %', 'מחיר', 'כמות', 'יחידה', 'תיאור', '#'];
    let x = 550;
    headers.forEach(header => {
      doc.text(header, x - 70, tableTop);
      x -= 70;
    });

    // Table rows
    let y = tableTop + 20;
    quote.items.forEach((item, index) => {
      x = 550;
      doc.text(item.total.toFixed(2), x - 70, y);
      doc.text(item.discount.toString(), x - 140, y);
      doc.text(item.price.toFixed(2), x - 210, y);
      doc.text(item.quantity.toString(), x - 280, y);
      doc.text(item.catalogItem.unit, x - 350, y);
      doc.text(item.catalogItem.description, x - 420, y);
      doc.text((index + 1).toString(), x - 490, y);
      y += 20;
    });

    // Add totals
    y += 20;
    doc.text(`סה״כ ללא מע״מ: ${quote.subtotal.toFixed(2)}`, 550, y, { align: 'right' });
    doc.text(`מע״מ (18%): ${(quote.subtotal * 0.18).toFixed(2)}`, 550, y + 20, { align: 'right' });
    doc.text(`סה״כ כולל מע״מ: ${quote.total.toFixed(2)}`, 550, y + 40, { align: 'right' });

    doc.end();
  }

    // ... rest of the PDF generation code ...
}

static async generateWord(quote) {
  // Add logo to Word document
  const sections = [{
    properties: { rtl: true },
    children: [
      // Add logo if exists
      quote.company?.logoData ? {
        type: "image",
        data: quote.company.logoData,
        transformation: {
          width: 150,
          height: 100
        }
      } : null,
      // ... rest of the Word document content ...
    ].filter(Boolean) // Remove null if no logo
  }];
  
  // Generate Word document
  static async generateWord(quote) {
    const doc = new Document({
      sections: [{
        properties: { rtl: true },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'הצעת מחיר', size: 40 })
            ],
            alignment: AlignmentType.RIGHT
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `מספר: ${quote.number}` }),
              new TextRun({ text: `\tתאריך: ${new Date().toLocaleDateString('he-IL')}` })
            ],
            alignment: AlignmentType.RIGHT
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '#' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'תיאור' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'יחידה' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'כמות' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'מחיר' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'הנחה %' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'סה״כ' })] })
                ]
              }),
              ...quote.items.map((item, index) => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: (index + 1).toString() })] }),
                  new TableCell({ children: [new Paragraph({ text: item.catalogItem.description })] }),
                  new TableCell({ children: [new Paragraph({ text: item.catalogItem.unit })] }),
                  new TableCell({ children: [new Paragraph({ text: item.quantity.toString() })] }),
                  new TableCell({ children: [new Paragraph({ text: item.price.toFixed(2) })] }),
                  new TableCell({ children: [new Paragraph({ text: item.discount.toString() })] }),
                  new TableCell({ children: [new Paragraph({ text: item.total.toFixed(2) })] })
                ]
              }))
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `סה״כ ללא מע״מ: ${quote.subtotal.toFixed(2)}` })
            ],
            alignment: AlignmentType.RIGHT
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `מע״מ (18%): ${(quote.subtotal * 0.18).toFixed(2)}` })
            ],
            alignment: AlignmentType.RIGHT
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `סה״כ כולל מע״מ: ${quote.total.toFixed(2)}` })
            ],
            alignment: AlignmentType.RIGHT
          })
        ]
      }]
    });

    return doc;
  }
}

module.exports = DocumentGenerator;