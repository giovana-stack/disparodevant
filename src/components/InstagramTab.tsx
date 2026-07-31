import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, CalendarClock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listSentNoticias } from "@/lib/rascunhos.functions";
import { gerarLegendaInstagram } from "@/lib/gemini.functions";
import { uploadImagemPost, salvarPostagemInstagram } from "@/lib/instagram.functions";

const VERDE_ESCURO = "rgba(25, 42, 37, 0.75)";
const VERDE_TAG = "#059A8E";
const VERDE_RODAPE = "#055B54";
const CREME = "#E5EDEC";

export function InstagramTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSentNoticias);
  const legendaFn = useServerFn(gerarLegendaInstagram);
  const uploadFn = useServerFn(uploadImagemPost);
  const salvarFn = useServerFn(salvarPostagemInstagram);

  const noticiasQ = useQuery({ queryKey: ["noticias-selecionaveis"], queryFn: () => listFn() });

  const [selecionada, setSelecionada] = useState("");
  const [titulo, setTitulo] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [agendadoPara, setAgendadoPara] = useState("");
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [salvando, setSalvando] = useState<null | "agendar" | "agora">(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const noticia = (noticiasQ.data ?? []).find((n) => String(n.id) === selecionada);

  function escolherNoticia(id: string) {
    setSelecionada(id);
    const n = (noticiasQ.data ?? []).find((x) => String(x.id) === id);
    setTitulo(n?.titulo || "");
    setImagemUrl(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagem(String(reader.result));
      setImagemUrl(null);
    };
    reader.readAsDataURL(f);
  }

  async function gerarLegenda() {
    if (!titulo.trim()) return;
    setGerando(true);
    try {
      const r = await legendaFn({ data: { titulo } });
      setLegenda(r.legenda);
      toast.success("Legenda gerada — revise antes de agendar");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function exportar() {
    if (!previewRef.current) return;
    setExportando(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const r = await uploadFn({ data: { dataUrl } });
      setImagemUrl(r.url);
      toast.success("Imagem exportada!");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao exportar imagem");
    } finally {
      setExportando(false);
    }
  }

  async function salvar(modo: "agendar" | "agora") {
    setSalvando(modo);
    try {
      await salvarFn({
        data: {
          titulo,
          imagem_url: imagemUrl || "",
          legenda,
          agendado_para:
            modo === "agora" ? new Date().toISOString() : new Date(agendadoPara).toISOString(),
          status: modo === "agora" ? "publicar_agora" : "agendado",
          rascunho_id: noticia?.id ?? null,
        },
      });
      toast.success(modo === "agora" ? "Enviado para publicação!" : "Postagem agendada!");
      qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
      setLegenda("");
      setImagem(null);
      setImagemUrl(null);
      setAgendadoPara("");
      setSelecionada("");
      setTitulo("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Criar post de Instagram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Selecione uma notícia</Label>
            <Select value={selecionada} onValueChange={escolherNoticia}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma notícia..." />
              </SelectTrigger>
              <SelectContent>
                {(noticiasQ.data ?? []).map((n) => (
                  <SelectItem key={String(n.id)} value={String(n.id)}>
                    {(n.titulo || n.mensagem || "").slice(0, 80)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selecionada && (
            <div className="space-y-1.5">
              <Label htmlFor="ig-img">Envie a imagem de fundo</Label>
              <Input id="ig-img" type="file" accept="image/*" onChange={onFile} />
            </div>
          )}
        </CardContent>
      </Card>

      {selecionada && imagem && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prévia da arte (clique no título para editar)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full overflow-x-auto flex justify-center">
              <div
                ref={previewRef}
                style={{
                  position: "relative",
                  width: 540,
                  height: 675,
                  flex: "0 0 auto",
                  overflow: "hidden",
                  fontFamily: "'Montserrat', Arial, sans-serif",
                  background: "#0F172A",
                }}
              >
                {/* Camada 1: fundo */}
                <img
                  src={imagem}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {/* Camada 2: overlay */}
                <div style={{ position: "absolute", inset: 0, background: VERDE_ESCURO }} />
                {/* Camada 3: faixa de acento topo */}
                <div
                  style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: VERDE_TAG }}
                />
                {/* Camada 4: tag NOTÍCIA */}
                <div
                  style={{
                    position: "absolute",
                    top: 40,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      background: VERDE_TAG,
                      color: "#FFFFFF",
                      fontFamily: "'Montserrat', Arial, sans-serif",
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: 2,
                      padding: "8px 22px",
                      borderRadius: 999,
                    }}
                  >
                    NOTÍCIA
                  </span>
                </div>
                {/* Camadas 5-8: bloco central (título + linhas + isotipo) */}
                <div
                  style={{
                    position: "absolute",
                    top: 90,
                    left: 0,
                    right: 0,
                    bottom: 100,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 28,
                  }}
                >
                  {/* Camada 5: título editável */}
                  <div
                    style={{
                      width: "100%",
                      paddingLeft: 44,
                      paddingRight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => setTitulo(e.currentTarget.innerText)}
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "'Montserrat', Arial, sans-serif",
                        fontWeight: 700,
                        fontSize: 40,
                        lineHeight: 1.2,
                        textAlign: "center",
                        textShadow: "0 2px 12px rgba(0,0,0,0.55)",
                        outline: "none",
                        width: "100%",
                      }}
                    >
                      {titulo}
                    </div>
                  </div>
                  {/* Camadas 6-8: linhas decorativas + isotipo */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 16,
                    }}
                  >
                    <div style={{ width: 150, height: 2, background: "#C4A35A" }} />
                    <img
                      src="https://adgcnounhstuqwpvfpgp.supabase.co/storage/v1/object/public/imagens/isotipo-branco.png"
                      alt=""
                      crossOrigin="anonymous"
                      style={{ width: 50, height: 50, opacity: 0.9, objectFit: "contain" }}
                    />
                    <div style={{ width: 150, height: 2, background: "#C4A35A" }} />
                  </div>
                </div>
                {/* Camada 9-10: logo no rodapé (sem barra de fundo) */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src="https://adgcnounhstuqwpvfpgp.supabase.co/storage/v1/object/public/imagens/devant.png"
                    alt=""
                    crossOrigin="anonymous"
                    style={{ width: 180, opacity: 0.95, objectFit: "contain" }}
                  />
                </div>
                {/* Camada 11: faixa de acento base */}
                <div
                  style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: VERDE_TAG }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ig-legenda">Legenda do Instagram</Label>
              <Textarea
                id="ig-legenda"
                rows={7}
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                placeholder="Escreva ou gere a legenda..."
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={gerando || !titulo.trim()}
                onClick={gerarLegenda}
              >
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar legenda com IA"}
              </Button>
            </div>

            <Button className="w-full" disabled={exportando} onClick={exportar}>
              {exportando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" /> Exportar imagem
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {imagemUrl && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Imagem final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <img
              src={imagemUrl}
              alt="Post final"
              className="w-full max-w-[320px] mx-auto rounded-lg border"
            />
            <div className="space-y-1.5">
              <Label htmlFor="ig-data">Agendar para</Label>
              <Input
                id="ig-data"
                type="datetime-local"
                value={agendadoPara}
                onChange={(e) => setAgendadoPara(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={salvando !== null || !agendadoPara}
                onClick={() => salvar("agendar")}
              >
                {salvando === "agendar" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CalendarClock className="w-4 h-4 mr-1" /> Agendar
                  </>
                )}
              </Button>
              <Button disabled={salvando !== null} onClick={() => salvar("agora")}>
                {salvando === "agora" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" /> Publicar agora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
