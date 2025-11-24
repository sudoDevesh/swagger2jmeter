"use client";
import React, { useState, useEffect } from "react";

// ---------------- Types ---------------- //

interface SwaggerDoc {
    openapi?: string;
    swagger?: string;
    info?: {
        title?: string;
        version?: string;
    };
    servers?: { url: string }[];
    host?: string;
    schemes?: string[];
    basePath?: string;
    paths?: Record<string, any>;
    parameters?: Record<string, any>;
    components?: {
        securitySchemes?: Record<string, any>;
        schemas?: Record<string, any>;
    };
}

interface Endpoint {
    path: string;
    method: string;
    summary?: string;
    description?: string;
    parameters?: any[];
    requestBody?: any;
    tags?: string[];
    rawOperation?: any;
    _index?: number;
}

// ---------------- Component ---------------- //

export default function App() {
    const [url, setUrl] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [swagger, setSwagger] = useState<SwaggerDoc | null>(null);
    const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [title, setTitle] = useState<string>("Generated Test Plan");
    const [threads, setThreads] = useState<number>(10);
    const [rampTime, setRampTime] = useState<number>(1);
    const [duration, setDuration] = useState<number>(60);
    const [baseUrlOverride, setBaseUrlOverride] = useState<string>("");

    const [commonHeaders, setCommonHeaders] = useState<{ key: string; value: string }[]>([
        { key: "Authorization", value: "Bearer ${TOKEN}" },
        { key: "Content-Type", value: "application/json" }
    ]);

    useEffect(() => {
        setSelected(new Set());
    }, [endpoints]);

    function extractBaseUrl(swaggerUrl: string): string {
        try {
            const u = new URL(swaggerUrl);
            return `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;
        } catch {
            return "";
        }
    }

    // ---------------- Fetch Swagger ---------------- //
    async function fetchSwagger() {
        setError("");
        setSwagger(null);
        setEndpoints([]);
        setLoading(true);

        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);

            const data: SwaggerDoc = await res.json();
            setSwagger(data);

            const autoBase = extractBaseUrl(url);
            setBaseUrlOverride(autoBase);

            const eps = parseOpenAPI(data);
            setEndpoints(eps);
        } catch (e: any) {
            setError(String(e.message || e));
        } finally {
            setLoading(false);
        }
    }

    // ---------------- Selection ---------------- //
    function toggleSelect(i: number) {
        const s = new Set(selected);
        s.has(i) ? s.delete(i) : s.add(i);
        setSelected(s);
    }

    function selectAll() {
        setSelected(new Set(endpoints.map((_, i) => i)));
    }

    function deselectAll() {
        setSelected(new Set());
    }

    function groupedByTag(list: Endpoint[]) {
        const map = new Map<string, Endpoint[]>();

        list.forEach((e, i) => {
            const tag = e.tags?.[0] ?? "default";
            if (!map.has(tag)) map.set(tag, []);
            map.get(tag)!.push({ ...e, _index: i });
        });

        return Array.from(map.entries());
    }

    // ---------------- Build JMX ---------------- //
    function buildJmxAndDownload() {
        if (!swagger) return;

        const chosen = endpoints.filter((_, i) => selected.has(i));
        if (chosen.length === 0) {
            setError("No endpoints selected");
            return;
        }

        const jmx = generateJMX({
            title,
            baseUrl: baseUrlOverride || detectBaseUrl(swagger) || "${BASE_URL}",
            threads,
            rampTime,
            duration,
            endpoints: chosen,
            commonHeaders
        });

        const blob = new Blob([jmx], { type: "application/xml" });
        const href = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = href;
        a.download = `${title.replace(/\s+/g, "_")}.jmx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">

                <header className="mb-6">
                    <h1 className="text-2xl font-semibold">Swagger → JMeter (.jmx) Generator</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Paste a Swagger/OpenAPI JSON URL and generate a JMeter test plan.
                    </p>
                </header>

                {/* Input */}
                <section className="space-y-3">
                    <label className="block">
                        <div className="text-sm font-medium text-slate-700">Swagger/OpenAPI URL</div>
                        <div className="flex gap-2 mt-2">
                            <input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://localhost:5000/swagger/v1/swagger.json"
                                className="flex-1 border rounded px-3 py-2"
                            />
                            <button
                                onClick={fetchSwagger}
                                disabled={loading || !url}
                                className="px-4 py-2 bg-sky-600 text-white rounded disabled:opacity-60"
                            >
                                {loading ? "Fetching..." : "Fetch"}
                            </button>
                        </div>
                    </label>

                    {error && <div className="text-red-600">{error}</div>}

                    {/* Swagger loaded */}
                    {swagger && (
                        <div className="border rounded p-3 bg-slate-50">

                            {/* Common Headers */}
                            <div className="mt-4 border rounded p-3 bg-slate-100">
                                <div className="font-medium mb-2">Common Headers</div>

                                {commonHeaders.map((h, i) => (
                                    <div key={i} className="flex gap-2 mb-2">
                                        <input
                                            value={h.key}
                                            placeholder="Header Name"
                                            onChange={(e) => {
                                                const arr = [...commonHeaders];
                                                arr[i].key = e.target.value;
                                                setCommonHeaders(arr);
                                            }}
                                            className="border rounded px-2 py-1 w-1/3"
                                        />
                                        <input
                                            value={h.value}
                                            placeholder="Header Value"
                                            onChange={(e) => {
                                                const arr = [...commonHeaders];
                                                arr[i].value = e.target.value;
                                                setCommonHeaders(arr);
                                            }}
                                            className="border rounded px-2 py-1 w-2/3"
                                        />
                                    </div>
                                ))}

                                <button
                                    onClick={() => setCommonHeaders([...commonHeaders, { key: "", value: "" }])}
                                    className="px-3 py-1 border rounded"
                                >
                                    + Add Header
                                </button>

                                <button
                                    onClick={() =>
                                        setCommonHeaders([
                                            ...commonHeaders,
                                            { key: "Authorization", value: "Bearer ${TOKEN}" }
                                        ])
                                    }
                                    className="px-3 py-1 border rounded ml-2"
                                >
                                    + Authorization Bearer
                                </button>
                            </div>

                            {/* Info */}
                            <div className="flex justify-between items-center mt-3">
                                <div>
                                    <div className="text-sm text-slate-600">Title</div>
                                    <div className="font-medium">
                                        {swagger.info?.title ?? swagger.swagger ?? "OpenAPI"}
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600">
                                    Version: {swagger.info?.version ?? "-"}
                                </div>
                            </div>

                            {/* Plan Settings */}
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                <label className="text-sm">
                                    <div className="text-slate-600">Output TestPlan Title</div>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                </label>

                                <label className="text-sm">
                                    <div className="text-slate-600">Base URL</div>
                                    <input
                                        value={baseUrlOverride}
                                        onChange={(e) => setBaseUrlOverride(e.target.value)}
                                        placeholder="http://localhost:5000"
                                        className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                </label>
                            </div>

                            {/* Performance Settings */}
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <label className="text-sm">
                                    <div className="text-slate-600">Threads</div>
                                    <input
                                        value={threads}
                                        onChange={(e) => setThreads(Number(e.target.value))}
                                        className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-slate-600">Ramp-up</div>
                                    <input
                                        value={rampTime}
                                        onChange={(e) => setRampTime(Number(e.target.value))}
                                        className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-slate-600">Duration</div>
                                    <input
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                        className="w-full border rounded px-2 py-1 mt-1"
                                    />
                                </label>
                            </div>

                            {/* Selectors */}
                            <div className="mt-3 flex gap-2">
                                <button onClick={selectAll} className="px-3 py-1 border rounded">Select All</button>
                                <button onClick={deselectAll} className="px-3 py-1 border rounded">Deselect All</button>
                            </div>

                            {/* Endpoints */}
                            <div className="mt-4">
                                <h3 className="font-medium mb-2">Detected endpoints</h3>
                                <div className="space-y-2 max-h-64 overflow-auto">
                                    {groupedByTag(endpoints).map(([tag, eps]) => (
                                        <div key={tag} className="border rounded p-2 bg-white">
                                            <div className="text-sm font-semibold">{tag}</div>
                                            <div className="mt-2 space-y-1">
                                                {eps.map(ep => (
                                                    <label key={ep._index} className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.has(ep._index!)}
                                                            onChange={() => toggleSelect(ep._index!)}
                                                        />
                                                        <div>
                                                            <div className="text-sm font-mono">[{ep.method}] {ep.path}</div>
                                                            <div className="text-xs text-slate-500">{ep.summary}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={buildJmxAndDownload}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded"
                                >
                                    Generate & Download .jmx
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(swagger, null, 2));
                                    }}
                                    className="px-4 py-2 border rounded"
                                >
                                    Copy Raw Swagger
                                </button>
                            </div>
                        </div>
                    )}

                    {!swagger && (
                        <div className="text-sm text-slate-500">
                            Enter a public Swagger URL. If blocked by CORS, use a proxy.
                        </div>
                    )}
                </section>

                <footer className="mt-6 text-xs text-slate-500">
    Developed with <span className="animate-pulse">❤️</span> by Devesh Korde
</footer>
            </div>
        </div>
    );
}

// ---------------------- Helper Functions ---------------------- //

function parseOpenAPI(doc: SwaggerDoc): Endpoint[] {
    const out: Endpoint[] = [];
    if (!doc) return out;

    const isV3 = !!doc.openapi?.startsWith("3");
    const paths = doc.paths || {};

    for (const path of Object.keys(paths)) {
        const obj = paths[path];
        for (const method of Object.keys(obj)) {
            const m = obj[method];
            if (!m || typeof m !== "object") continue;

            const parameters = (m.parameters ?? []).slice();
            const requestBody = isV3 ? m.requestBody ?? null : null;

            out.push({
                path,
                method: method.toUpperCase(),
                summary: m.summary || m.operationId,
                description: m.description,
                parameters,
                requestBody,
                tags: m.tags ?? [],
                rawOperation: m
            });
        }
    }

    return out;
}

function detectBaseUrl(doc: SwaggerDoc): string | null {
    try {
        if (doc.servers?.length) return doc.servers[0].url;
        if (doc.host) {
            const scheme = doc.schemes?.[0] ?? "http";
            return `${scheme}://${doc.host}${doc.basePath ?? ""}`;
        }
        return null;
    } catch {
        return null;
    }
}

function escapeXml(s: any): string {
    if (s == null) return "";
    return String(s).replace(/[<>&'"]/g, c => {
        switch (c) {
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "&": return "&amp;";
            case "'": return "&apos;";
            case '"': return "&quot;";
            default: return c;
        }
    });
}

function generateJMX({
    title,
    baseUrl,
    threads,
    rampTime,
    duration,
    endpoints,
    commonHeaders
}: {
    title: string;
    baseUrl: string;
    threads: number;
    rampTime: number;
    duration: number;
    endpoints: Endpoint[];
    commonHeaders: { key: string; value: string }[];
}): string {
    const testPlanName = escapeXml(title || "Test Plan");
    const varBaseUrl = baseUrl || "${BASE_URL}";

    // split base url to protocol/host/port for JMeter fields
    const { protocol: resolvedProtocol, host: resolvedHost, port: resolvedPort } = splitBaseUrl(varBaseUrl);

    const jmx: string[] = [];

    jmx.push('<?xml version="1.0" encoding="UTF-8"?>');
    jmx.push('<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">');
    jmx.push('<hashTree>');

    // ----------------- Test Plan -----------------
    jmx.push(`<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${testPlanName}" enabled="true">`);
    jmx.push('<stringProp name="TestPlan.comments"></stringProp>');
    jmx.push('<boolProp name="TestPlan.functional_mode">false</boolProp>');
    jmx.push('<boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>');
    jmx.push('<boolProp name="TestPlan.serialize_threadgroups">false</boolProp>');
    jmx.push('<elementProp name="TestPlan.user_defined_variables" elementType="Arguments">');
    jmx.push('<collectionProp name="Arguments.arguments">');

    // BASE_URL variable (kept for backward compatibility)
    jmx.push('<elementProp name="BASE_URL" elementType="Argument">');
    jmx.push('<stringProp name="Argument.name">BASE_URL</stringProp>');
    jmx.push(`<stringProp name="Argument.value">${escapeXml(varBaseUrl)}</stringProp>`);
    jmx.push('<stringProp name="Argument.metadata">=</stringProp>');
    jmx.push('</elementProp>');

    // PROTOCOL variable
    jmx.push('<elementProp name="PROTOCOL" elementType="Argument">');
    jmx.push('<stringProp name="Argument.name">PROTOCOL</stringProp>');
    jmx.push(`<stringProp name="Argument.value">${escapeXml(resolvedProtocol)}</stringProp>`);
    jmx.push('<stringProp name="Argument.metadata">=</stringProp>');
    jmx.push('</elementProp>');

    // SERVER_NAME variable
    jmx.push('<elementProp name="SERVER_NAME" elementType="Argument">');
    jmx.push('<stringProp name="Argument.name">SERVER_NAME</stringProp>');
    jmx.push(`<stringProp name="Argument.value">${escapeXml(resolvedHost)}</stringProp>`);
    jmx.push('<stringProp name="Argument.metadata">=</stringProp>');
    jmx.push('</elementProp>');

    // PORT variable
    jmx.push('<elementProp name="PORT" elementType="Argument">');
    jmx.push('<stringProp name="Argument.name">PORT</stringProp>');
    jmx.push(`<stringProp name="Argument.value">${escapeXml(resolvedPort)}</stringProp>`);
    jmx.push('<stringProp name="Argument.metadata">=</stringProp>');
    jmx.push('</elementProp>');

    jmx.push('</collectionProp>');
    jmx.push('</elementProp>');
    jmx.push('<stringProp name="TestPlan.user_define_classpath"></stringProp>');
    jmx.push('</TestPlan>');
    jmx.push('<hashTree>'); // <-- child of TestPlan

    // ----------------- Thread Group -----------------
    jmx.push('<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" enabled="true" testname="Thread Group">');
    jmx.push('<stringProp name="ThreadGroup.on_sample_error">continue</stringProp>');
    jmx.push('<elementProp name="ThreadGroup.main_controller" elementType="LoopController">');
    jmx.push('<boolProp name="LoopController.continue_forever">false</boolProp>');
    jmx.push('<stringProp name="LoopController.loops">-1</stringProp>');
    jmx.push('</elementProp>');
    jmx.push(`<stringProp name="ThreadGroup.num_threads">${threads}</stringProp>`);
    jmx.push(`<stringProp name="ThreadGroup.ramp_time">${rampTime}</stringProp>`);
    jmx.push('<boolProp name="ThreadGroup.scheduler">true</boolProp>');
    jmx.push(`<stringProp name="ThreadGroup.duration">${duration}</stringProp>`);
    jmx.push('<stringProp name="ThreadGroup.delay"></stringProp>');
    jmx.push('</ThreadGroup>');
    jmx.push('<hashTree>'); // <-- child of ThreadGroup

    // ----------------- Samplers -----------------
    for (const ep of endpoints) {
        const name = `${ep.method} ${ep.path}`;
        // HTTPSamplerProxy
        jmx.push(`<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${escapeXml(name)}" enabled="true">`);
        jmx.push('<boolProp name="HTTPSampler.postBodyRaw">true</boolProp>');
        jmx.push('<elementProp name="HTTPsampler.Arguments" elementType="Arguments">');
        jmx.push('<collectionProp name="Arguments.arguments"></collectionProp>');
        jmx.push('</elementProp>');

        // Use variables we set for protocol/host/port and keep path as-is (escaped)
        jmx.push('<stringProp name="HTTPSampler.domain">${SERVER_NAME}</stringProp>');
        jmx.push('<stringProp name="HTTPSampler.port">${PORT}</stringProp>');
        jmx.push('<stringProp name="HTTPSampler.protocol">${PROTOCOL}</stringProp>');
        jmx.push(`<stringProp name="HTTPSampler.path">${escapeXml(ep.path)}</stringProp>`);
        jmx.push(`<stringProp name="HTTPSampler.method">${escapeXml(ep.method)}</stringProp>`);
        jmx.push('<boolProp name="HTTPSampler.follow_redirects">true</boolProp>');
        jmx.push('<boolProp name="HTTPSampler.auto_redirects">false</boolProp>');
        jmx.push('<boolProp name="HTTPSampler.use_keepalive">true</boolProp>');
        jmx.push('<boolProp name="HTTPSampler.DO_MULTIPART_POST">false</boolProp>');
        jmx.push('</HTTPSamplerProxy>');

        // sampler hashTree
        jmx.push('<hashTree>');

        // ---------------- Header Manager ----------------
        jmx.push('<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Header Manager" enabled="true">');
        jmx.push('<collectionProp name="HeaderManager.headers">');

        // Inject commonHeaders (only non-empty keys)
        for (const h of commonHeaders || []) {
            if (!h || !String(h.key || "").trim()) continue;
            const keyEsc = escapeXml(h.key);
            const valueEsc = escapeXml(h.value ?? "");
            jmx.push(`<elementProp name="${keyEsc}" elementType="Header">`);
            jmx.push(`<stringProp name="Header.name">${keyEsc}</stringProp>`);
            jmx.push(`<stringProp name="Header.value">${valueEsc}</stringProp>`);
            jmx.push('</elementProp>');
        }

        jmx.push('</collectionProp>');
        jmx.push('</HeaderManager>');
        jmx.push('<hashTree />'); // child of HeaderManager

        jmx.push('</hashTree>'); // close sampler hashTree
    }

    // After samplers we can add a ResultCollector (View Results Tree) as a child of ThreadGroup
    // Add the ResultCollector and an empty filename (it will display in GUI)
    jmx.push(
        `<ResultCollector guiclass="ViewResultsFullVisualizer" testclass="ResultCollector" testname="View Results Tree" enabled="true">
            <boolProp name="ResultCollector.error_logging">false</boolProp>
            <objProp>
                <name>saveConfig</name>
                <value class="SampleSaveConfiguration">
                    <time>true</time>
                    <latency>true</latency>
                    <timestamp>true</timestamp>
                    <success>true</success>
                    <label>true</label>
                    <code>true</code>
                    <message>true</message>
                    <threadName>true</threadName>
                    <dataType>true</dataType>
                    <encoding>true</encoding>
                    <assertions>true</assertions>
                    <subresults>true</subresults>
                    <responseData>false</responseData>
                    <samplerData>false</samplerData>
                    <xml>true</xml>
                    <fieldNames>true</fieldNames>
                    <responseHeaders>false</responseHeaders>
                    <requestHeaders>false</requestHeaders>
                    <responseDataOnError>false</responseDataOnError>
                    <saveAssertionResultsFailureMessage>true</saveAssertionResultsFailureMessage>
                    <assertionsResultsToSave>0</assertionsResultsToSave>
                    <bytes>true</bytes>
                    <sentBytes>true</sentBytes>
                    <url>true</url>
                    <threadCounts>true</threadCounts>
                    <idleTime>true</idleTime>
                    <connectTime>true</connectTime>
                </value>
            </objProp>
            <stringProp name="filename"></stringProp>
        </ResultCollector>`
    );
    jmx.push('<hashTree />'); // hashTree for ResultCollector (empty child)

    // close ThreadGroup hashTree and TestPlan hashTree
    jmx.push('</hashTree>'); // close ThreadGroup hashTree
    jmx.push('</hashTree>'); // close TestPlan hashTree
    jmx.push('</hashTree>'); // close top-level hashTree
    jmx.push('</jmeterTestPlan>');

    return jmx.join("\n");
}

function splitBaseUrl(url: string) {
    try {
        const u = new URL(url);
        const protocol = u.protocol.replace(":", "");
        const host = u.hostname;
        const port = u.port || (protocol === "https" ? "443" : "80");

        return { protocol, host, port };
    } catch {
        return { protocol: "${PROTOCOL}", host: "${SERVER_NAME}", port: "${PORT}" };
    }
}

