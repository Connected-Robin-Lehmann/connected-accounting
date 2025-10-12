import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Download, Trash2, DollarSign, Edit, Eye, Paperclip, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  description: string | null;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  invoice_document_id: string | null;
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    status: "pending",
    description: "",
    due_date: "",
    invoice_document_id: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [id]);

  const loadClientData = async () => {
    if (!id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [clientResult, paymentsResult, documentsResult] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).eq("user_id", user.id).single(),
        supabase.from("payments").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("documents").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);

      if (clientResult.error) throw clientResult.error;
      
      setClient(clientResult.data);
      setPayments(paymentsResult.data || []);
      setDocuments(documentsResult.data || []);
    } catch (error) {
      console.error("Error loading client data:", error);
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentForm.amount || !id) {
      toast.error("Amount is required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let invoiceDocId = paymentForm.invoice_document_id;

      // Upload invoice file if provided
      if (invoiceFile) {
        const fileExt = invoiceFile.name.split(".").pop();
        const fileName = `${user.id}/${id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("client-documents")
          .upload(fileName, invoiceFile);

        if (uploadError) throw uploadError;

        const { data: docData, error: dbError } = await supabase
          .from("documents")
          .insert({
            client_id: id,
            user_id: user.id,
            file_name: invoiceFile.name,
            file_path: fileName,
            file_size: invoiceFile.size,
            file_type: invoiceFile.type,
          })
          .select()
          .single();

        if (dbError) throw dbError;
        invoiceDocId = docData.id;
      }

      if (editingPayment) {
        // Update existing payment
        const { error } = await supabase
          .from("payments")
          .update({
            amount: parseFloat(paymentForm.amount),
            status: paymentForm.status,
            description: paymentForm.description || null,
            due_date: paymentForm.due_date || null,
            paid_date: paymentForm.status === "paid" ? new Date().toISOString().split("T")[0] : null,
            invoice_document_id: invoiceDocId || null,
          })
          .eq("id", editingPayment.id);

        if (error) throw error;
        toast.success("Payment updated successfully");
      } else {
        // Create new payment
        const { error } = await supabase.from("payments").insert({
          client_id: id,
          user_id: user.id,
          amount: parseFloat(paymentForm.amount),
          status: paymentForm.status,
          description: paymentForm.description || null,
          due_date: paymentForm.due_date || null,
          paid_date: paymentForm.status === "paid" ? new Date().toISOString().split("T")[0] : null,
          invoice_document_id: invoiceDocId || null,
        });

        if (error) throw error;
        toast.success("Payment added successfully");
      }

      setPaymentDialogOpen(false);
      setEditingPayment(null);
      setInvoiceFile(null);
      setPaymentForm({ amount: "", status: "pending", description: "", due_date: "", invoice_document_id: "" });
      loadClientData();
    } catch (error) {
      console.error("Error saving payment:", error);
      toast.error("Failed to save payment");
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setInvoiceFile(null);
    setPaymentForm({
      amount: payment.amount.toString(),
      status: payment.status,
      description: payment.description || "",
      due_date: payment.due_date || "",
      invoice_document_id: payment.invoice_document_id || "",
    });
    setPaymentDialogOpen(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;

      toast.success("Payment deleted successfully");
      loadClientData();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        client_id: id,
        user_id: user.id,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        file_type: file.type,
      });

      if (dbError) throw dbError;

      toast.success("Document uploaded successfully");
      setUploadDialogOpen(false);
      loadClientData();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download document");
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("client-documents")
        .remove([document.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;

      toast.success("Document deleted successfully");
      loadClientData();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handlePreviewDocument = async (document: Document) => {
    try {
      const { data } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (data?.signedUrl) {
        // Construct full URL with Supabase project URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const fullUrl = data.signedUrl.startsWith('http') 
          ? data.signedUrl 
          : `${supabaseUrl}/storage/v1${data.signedUrl}`;
        
        setPreviewUrl(fullUrl);
        setPreviewDocument(document);
      } else {
        toast.error("Failed to generate preview URL");
      }
    } catch (error) {
      console.error("Error previewing document:", error);
      toast.error("Failed to preview document");
    }
  };

  const getInvoiceDocument = (invoiceId: string | null) => {
    if (!invoiceId) return null;
    return documents.find(doc => doc.id === invoiceId);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      paid: { variant: "default", label: "Paid" },
      pending: { variant: "secondary", label: "Pending" },
      overdue: { variant: "destructive", label: "Overdue" },
    };
    
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalPending = payments
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <div>Loading...</div>;
  if (!client) return <div>Client not found</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/clients")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Button>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{client.name}</h2>
        {client.company && <p className="text-muted-foreground">{client.company}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-success">${totalPaid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Pending</p>
              <p className="text-2xl font-bold text-warning">${totalPending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p>{client.email}</p>
              </div>
            )}
            {client.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p>{client.phone}</p>
              </div>
            )}
            {client.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
            setPaymentDialogOpen(open);
            if (!open) {
              setEditingPayment(null);
              setInvoiceFile(null);
              setPaymentForm({ amount: "", status: "pending", description: "", due_date: "", invoice_document_id: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPayment ? "Edit Payment" : "Add Payment"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={paymentForm.status} onValueChange={(value) => setPaymentForm({ ...paymentForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={paymentForm.due_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Invoice Attachment</Label>
                  <div className="space-y-3">
                    {/* Upload new invoice */}
                    <div className="border-2 border-dashed rounded-lg p-4">
                      <Label htmlFor="invoice_upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {invoiceFile ? invoiceFile.name : "Click to upload invoice PDF"}
                        </span>
                        <Input
                          id="invoice_upload"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setInvoiceFile(file);
                              setPaymentForm({ ...paymentForm, invoice_document_id: "" });
                            }
                          }}
                          className="hidden"
                        />
                      </Label>
                      {invoiceFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setInvoiceFile(null)}
                          className="w-full mt-2"
                        >
                          Clear file
                        </Button>
                      )}
                    </div>

                    {/* Or select existing document */}
                    {!invoiceFile && documents.length > 0 && (
                      <>
                        <div className="text-center text-sm text-muted-foreground">or</div>
                        <div className="space-y-2">
                          <Label htmlFor="invoice_document">Select existing document</Label>
                          <Select 
                            value={paymentForm.invoice_document_id || undefined} 
                            onValueChange={(value) => setPaymentForm({ ...paymentForm, invoice_document_id: value })}
                            disabled={!!invoiceFile}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="No document selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {documents.map((doc) => (
                                <SelectItem key={doc.id} value={doc.id}>
                                  {doc.file_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {paymentForm.invoice_document_id && !invoiceFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaymentForm({ ...paymentForm, invoice_document_id: "" })}
                        className="text-xs w-full"
                      >
                        Clear selection
                      </Button>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90">
                  {editingPayment ? "Update Payment" : "Add Payment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payments recorded yet</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const invoiceDoc = getInvoiceDocument(payment.invoice_document_id);
                return (
                  <div key={payment.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">${Number(payment.amount).toFixed(2)}</p>
                        {getStatusBadge(payment.status)}
                      </div>
                      {payment.description && (
                        <p className="text-sm text-muted-foreground">{payment.description}</p>
                      )}
                      {payment.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(payment.due_date).toLocaleDateString()}
                        </p>
                      )}
                      {invoiceDoc && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          <span>Invoice: {invoiceDoc.file_name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreviewDocument(invoiceDoc)}
                            className="h-6 px-2"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditPayment(payment)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePayment(payment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PDF, DOC, DOCX, and more
                  </p>
                </div>
                {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(doc.created_at).toLocaleDateString()}
                      {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handlePreviewDocument(doc)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDownload(doc)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteDocument(doc)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDocument} onOpenChange={(open) => {
        if (!open) {
          setPreviewDocument(null);
          setPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0">
          <div className="p-6 pb-2">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{previewDocument?.file_name}</DialogTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPreviewDocument(null);
                    setPreviewUrl(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <DialogDescription>
                Preview document or open in new tab for full functionality
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 px-6 pb-4 overflow-hidden">
            {previewUrl && previewDocument ? (
              <object
                data={previewUrl}
                type="application/pdf"
                className="w-full h-full border rounded-lg"
                title={previewDocument.file_name}
              >
                <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                  <p className="text-muted-foreground text-center">
                    Unable to display PDF in browser
                  </p>
                  <Button
                    onClick={() => window.open(previewUrl, '_blank')}
                    variant="outline"
                  >
                    Open in New Tab
                  </Button>
                </div>
              </object>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Loading preview...</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 p-6 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => previewUrl && window.open(previewUrl, '_blank')}
            >
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              onClick={() => previewDocument && handleDownload(previewDocument)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetail;
