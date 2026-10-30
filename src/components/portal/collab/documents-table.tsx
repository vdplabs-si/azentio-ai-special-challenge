import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/portal/page";
import { DeleteDocumentButton } from "@/components/portal/collab/documents-actions";
import { FILE_KINDS, kindFromFilename } from "@/components/portal/collab/file-rules";
import { formatBytes } from "@/components/portal/collab/labels";
import { formatDateTime } from "@/components/portal/collab/dates";

export interface DocumentListItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploader: { id: string; name: string };
  canDelete: boolean;
}

/** Document metadata table; downloads go through the authorised download endpoint. */
export function DocumentsTable({ documents, emptyHint }: { documents: DocumentListItem[]; emptyHint: string }) {
  if (documents.length === 0) return <EmptyState icon={FileText} title="No documents yet" description={emptyHint} />;
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="hidden sm:table-cell">Size</TableHead>
            <TableHead className="hidden md:table-cell">Uploaded by</TableHead>
            <TableHead className="hidden md:table-cell">Uploaded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((d) => {
            const kind = kindFromFilename(d.filename);
            return (
              <TableRow key={d.id}>
                <TableCell className="max-w-72">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-brand-muted" aria-hidden />
                    <span className="truncate font-medium text-brand-ink" title={d.filename}>
                      {d.filename}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{kind ? FILE_KINDS[kind].label : d.mimeType}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatBytes(d.sizeBytes)}</TableCell>
                <TableCell className="hidden md:table-cell">{d.uploader.name}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{formatDateTime(d.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/api/v1/documents/${d.id}/download`} download>
                        <Download aria-hidden /> <span className="hidden sm:inline">Download</span>
                        <span className="sr-only sm:hidden">Download {d.filename}</span>
                      </a>
                    </Button>
                    {d.canDelete && <DeleteDocumentButton documentId={d.id} filename={d.filename} />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
