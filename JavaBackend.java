import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.util.LinkedHashMap;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class JavaBackend {
    private static final List<String> DATASET_KEYS = List.of("iss", "weather", "spaceWeather", "astronauts", "rocket", "nasa", "mission");
    private static final Map<String, String> DATASET_FILES = Map.ofEntries(
            Map.entry("iss", "iss.json"),
            Map.entry("spaceWeather", "spaceWeather.json"),
            Map.entry("weather", "spaceWeather.json"),
            Map.entry("astronauts", "astronauts.json"),
            Map.entry("rocket", "rocket.json"),
            Map.entry("nasa", "nasa.json"),
            Map.entry("mission", "mission.json")
    );

    // Required dataset structures. Values are validated before entering the cache.
    private static final Map<String, Object> DATA_SCHEMAS = Map.ofEntries(
        Map.entry("astronauts", List.of(Map.ofEntries(Map.entry("id", String.class), Map.entry("name", String.class), Map.entry("role", String.class), Map.entry("missionSpecialty", String.class), Map.entry("healthScore", Number.class), Map.entry("status", String.class), Map.entry("vitalSigns", Map.ofEntries(Map.entry("heartRate", Number.class), Map.entry("oxygenSaturation", Number.class), Map.entry("cabinPressure", Number.class), Map.entry("temperature", Number.class))), Map.entry("lastUpdate", String.class)))),
        Map.entry("iss", Map.ofEntries(Map.entry("name", String.class), Map.entry("latitude", Number.class), Map.entry("longitude", Number.class), Map.entry("altitude", Number.class), Map.entry("velocity", Number.class), Map.entry("timestamp", String.class), Map.entry("orbitPeriodMinutes", Number.class), Map.entry("powerGeneration", Number.class), Map.entry("nextPassOver", String.class))),
        Map.entry("mission", Map.ofEntries(Map.entry("missionId", String.class), Map.entry("missionName", String.class), Map.entry("phase", String.class), Map.entry("duration", String.class), Map.entry("startDate", String.class), Map.entry("objectives", List.of(String.class)), Map.entry("crewManifest", List.of(String.class)))),
        Map.entry("nasa", Map.ofEntries(Map.entry("apod", Map.ofEntries(Map.entry("title", String.class), Map.entry("explanation", String.class), Map.entry("url", String.class), Map.entry("hdurl", String.class), Map.entry("date", String.class))), Map.entry("asteroids", Map.ofEntries(Map.entry("hazardousCount", Number.class), Map.entry("closestAsteroid", String.class), Map.entry("closestDistance", Number.class), Map.entry("trackedToday", Number.class), Map.entry("summary", String.class))), Map.entry("solarActivity", Map.ofEntries(Map.entry("flareIndex", String.class), Map.entry("geomagneticStormLevel", String.class))))),
        Map.entry("rocket", Map.ofEntries(Map.entry("id", String.class), Map.entry("name", String.class), Map.entry("status", String.class), Map.entry("healthScore", Number.class), Map.entry("currentStage", String.class), Map.entry("lastCheck", String.class), Map.entry("systems", Map.ofEntries(Map.entry("thrust", Number.class), Map.entry("fuelPressure", Number.class), Map.entry("thermalManagement", Number.class), Map.entry("propulsionSystem", Number.class), Map.entry("avionicsHealth", Number.class))))),
        Map.entry("spaceWeather", Map.ofEntries(Map.entry("status", String.class), Map.entry("auroralPower", Number.class), Map.entry("plasmaDensity", Number.class), Map.entry("solarWindSpeed", Number.class), Map.entry("magneticFieldIntensity", Number.class), Map.entry("description", String.class), Map.entry("kpIndex", Number.class), Map.entry("solarFlux", Number.class), Map.entry("nextDowngradeRisk", String.class)))
    );

    private static final char DEGREE = '\u00B0';
    private static final Map<String, CacheEntry> CACHE = new HashMap<>();
    private static final Path DATA_FOLDER = resolveDataFolder();

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getProperty("astra.port", "5002"));
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", new ApiHandler());
        var executor = Executors.newFixedThreadPool(8);
        server.setExecutor(executor);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            server.stop(0);
            executor.shutdownNow();
        }));
        server.start();
        log("service_started", Map.of("port", server.getAddress().getPort()));
    }

    private static Path resolveDataFolder() {
        String configured = System.getProperty("astra.dataDir");
        if (configured != null) return Path.of(configured).toAbsolutePath();
        Path root = Path.of(System.getProperty("user.dir"));
        Path candidate = root.resolve("src").resolve("data-files");
        if (Files.exists(candidate)) {
            return candidate;
        }
        candidate = root.resolve("server").resolve("src").resolve("data-files");
        if (Files.exists(candidate)) {
            return candidate;
        }
        throw new IllegalStateException("Unable to locate the dataset folder from " + root);
    }

    private static Map<String, Object> healthPayload() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("service", "astrahealth-java");
        return response;
    }

    private static Map<String, Object> datasetKeysPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("status", "success");
        payload.put("keys", DATASET_KEYS);
        return payload;
    }

    private static Map<String, Object> telemetryPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("status", "success");
        payload.put("data", collectTelemetry());
        return payload;
    }

    private static Map<String, Object> collectTelemetry() {
        Map<String, Object> iss = castMap(loadDataset("iss"));
        Map<String, Object> spaceWeather = castMap(loadDataset("spaceWeather"));
        List<Object> astronauts = castList(loadDataset("astronauts"));
        Map<String, Object> rocket = castMap(loadDataset("rocket"));
        Map<String, Object> nasa = castMap(loadDataset("nasa"));
        Map<String, Object> mission = castMap(loadDataset("mission"));

        int astronautHealth = averageInt(astronauts, "healthScore");
        int rocketHealth = getInt(rocket, "healthScore");
        String astronautStatus = astronautHealth >= 92 ? "Stable" : astronautHealth >= 84 ? "Monitor" : "Attention";
        String rocketStatus = rocketHealth >= 92 ? "Stable" : rocketHealth >= 84 ? "Monitor" : "Attention";

        Map<String, Object> primaryAstronaut = astronauts.isEmpty() ? Map.of() : castMap(astronauts.get(0));
        Map<String, Object> astronautVitals = castMap(primaryAstronaut.getOrDefault("vitalSigns", Map.of()));
        Map<String, Object> rocketSystems = castMap(rocket.getOrDefault("systems", Map.of()));

        List<Object> alerts = List.of(
                String.format("NASA APOD: %s (%s)", getString(castMap(nasa.get("apod")), "title"), getString(castMap(nasa.get("apod")), "date")),
                String.format("ISS position: %.2f%cN, %.2f%cW", getDouble(iss, "latitude"), DEGREE, Math.abs(getDouble(iss, "longitude")), DEGREE),
                getString(castMap(nasa.get("asteroids")), "summary"),
                String.format("Space weather KP index: %d", getInt(spaceWeather, "kpIndex")),
                String.format("Crew health average: %d%%", astronautHealth)
        );

        List<Object> telemetry = List.of(
                Map.of("label", "Orbital lock", "value", orbitalLockValue(iss)),
                Map.of("label", "Space weather", "value", weatherQualityValue(spaceWeather)),
                Map.of("label", "Crew health", "value", astronautHealth),
                Map.of("label", "Vehicle status", "value", rocketHealth)
        );

        Map<String, Object> crewAndVehicleHealth = Map.of(
                "astronautHealthScore", astronautHealth,
                "rocketHealthScore", rocketHealth,
                "astronautStatus", astronautStatus,
                "rocketStatus", rocketStatus,
                "astronautNarrative", String.format("Crew readiness is %s. %d crew members are actively monitored.", astronautStatus.toLowerCase(), astronauts.size()),
                "rocketNarrative", String.format("Rocket systems are %s. Fuel, thrust and avionics are stable.", rocketStatus.toLowerCase()),
                "astronautVitalSigns", Map.of(
                        "oxygen", getInt(astronautVitals, "oxygenSaturation"),
                        "heartRate", getInt(astronautVitals, "heartRate"),
                        "cabinPressure", getDouble(astronautVitals, "cabinPressure"),
                        "temperature", getDouble(astronautVitals, "temperature")
                ),
                "rocketSystems", Map.of(
                        "thrust", getInt(rocketSystems, "thrust"),
                        "fuelPressure", getInt(rocketSystems, "fuelPressure"),
                        "thermal", getInt(rocketSystems, "thermalManagement"),
                        "avionics", getInt(rocketSystems, "avionicsHealth")
                )
        );

        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("missionStatus", String.format("%s â€¢ %s", getString(mission, "missionName"), getString(mission, "phase")));
        snapshot.put("orbit", String.format("%s / %.4f%c, %.4f%c â€¢ Alt: %.1f km", getString(iss, "name"), getDouble(iss, "latitude"), DEGREE, getDouble(iss, "longitude"), DEGREE, getDouble(iss, "altitude")));
        snapshot.put("weather", String.format("%s â€¢ %s", getString(spaceWeather, "status"), getString(spaceWeather, "description")));
        snapshot.put("alerts", alerts);
        snapshot.put("telemetry", telemetry);
        snapshot.put("nasaHighlight", getString(castMap(nasa.get("apod")), "title"));
        snapshot.put("nasaAsteroidSummary", getString(castMap(nasa.get("asteroids")), "summary"));
        snapshot.put("nasaImage", getString(castMap(nasa.get("apod")), "url"));
        snapshot.put("lastUpdated", nowUtc());
        snapshot.put("spaceWeatherStatus", getString(spaceWeather, "status"));
        snapshot.put("missionObjectives", castList(getObject(mission, "objectives")));
        snapshot.put("missionCrew", castList(getObject(mission, "crewManifest")));
        snapshot.put("spaceWeatherKPIndex", getInt(spaceWeather, "kpIndex"));
        snapshot.put("solarFlux", getInt(spaceWeather, "solarFlux"));
        snapshot.put("crewAndVehicleHealth", crewAndVehicleHealth);
        return snapshot;
    }

    private static double orbitalLockValue(Map<String, Object> iss) {
        double altitude = getDouble(iss, "altitude");
        double velocity = getDouble(iss, "velocity");
        double value = 100 - Math.abs(altitude - 408.5) * 0.75 - Math.abs(velocity - 27600) / 150;
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    private static int weatherQualityValue(Map<String, Object> weather) {
        double auroralPower = getDouble(weather, "auroralPower");
        int kpIndex = getInt(weather, "kpIndex");
        double value = 100 - (auroralPower / 6.0 + kpIndex * 4.0);
        return Math.max(0, Math.min(100, (int) Math.round(value)));
    }

    private static String nowUtc() {
        return java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC).toString();
    }

    private static synchronized Object loadDataset(String key) {
        String normalizedKey = key.equals("weather") ? "spaceWeather" : key;
        if (!DATASET_FILES.containsKey(normalizedKey)) throw new ApiError(400, "Invalid dataset key");
        Path file = DATA_FOLDER.resolve(DATASET_FILES.get(normalizedKey));
        try {
            var attributes = Files.readAttributes(file, java.nio.file.attribute.BasicFileAttributes.class);
            if (attributes.size() > 2 * 1024 * 1024) throw new IllegalStateException("Dataset exceeds 2 MB");
            CacheEntry cache = CACHE.get(normalizedKey);
            if (cache != null && cache.mtime.equals(attributes.lastModifiedTime()) && cache.size == attributes.size()) return cache.data;
            byte[] bytes;
            try (var input = Files.newInputStream(file)) { bytes = input.readNBytes(2 * 1024 * 1024 + 1); }
            if (bytes.length > 2 * 1024 * 1024) throw new IllegalStateException("Dataset exceeds 2 MB");
            String json = decodeUtf8(bytes);
            if (json.startsWith("\uFEFF")) json = json.substring(1);
            Object parsed = JsonCodec.parse(json);
            validateData(parsed, DATA_SCHEMAS.get(normalizedKey), normalizedKey);
            CACHE.put(normalizedKey, new CacheEntry(parsed, attributes.lastModifiedTime(), attributes.size()));
            log("dataset_loaded", Map.of("key", normalizedKey));
            return parsed;
        } catch (IOException | RuntimeException error) {
            log("service_failure", Map.of("component", "dataset", "key", normalizedKey, "error", error.toString()));
            throw new IllegalStateException("Dataset load failed", error);
        }
    }

    private static synchronized void clearCache() {
        CACHE.clear();
        log("dataset_cache_cleared", Map.of());
    }

    private static String decodeUtf8(byte[] bytes) throws IOException {
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
    }

    private record CacheEntry(Object data, java.nio.file.attribute.FileTime mtime, long size) {}

    private static void validateData(Object value, Object schema, String path) {
        if (schema instanceof Map<?, ?> fields) {
            if (!(value instanceof Map<?, ?> object)) throw new IllegalStateException(path + " must be an object");
            for (var entry : fields.entrySet()) validateData(object.get(entry.getKey()), entry.getValue(), path + "." + entry.getKey());
        } else if (schema instanceof List<?> itemSchema) {
            if (!(value instanceof List<?> items)) throw new IllegalStateException(path + " must be an array");
            for (Object item : items) validateData(item, itemSchema.get(0), path + "[]");
        } else if (schema == Number.class) {
            if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())) throw new IllegalStateException(path + " must be a finite number");
        } else if (!((Class<?>) schema).isInstance(value)) {
            throw new IllegalStateException(path + " has invalid type or is missing");
        }
    }

    private static Object getObject(Map<String, Object> source, String key) {
        return source.get(key);
    }

    private static String getString(Map<String, Object> source, String key) {
        Object value = source.get(key);
        return value == null ? "" : value.toString();
    }

    private static int getInt(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
            }
        }
        return 0;
    }

    private static double getDouble(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
            }
        }
        return 0.0;
    }

    private static int averageInt(List<Object> objects, String key) {
        if (objects.isEmpty()) {
            return 0;
        }
        int sum = 0;
        for (Object item : objects) {
            sum += getInt(castMap(item), key);
        }
        return Math.round((float) sum / objects.size());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> castList(Object value) {
        return (List<Object>) value;
    }

    private static void log(String event, Map<String, ?> context) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("timestamp", nowUtc());
        record.put("service", "astrahealth-java");
        record.put("event", event);
        record.putAll(context);
        System.out.println(JsonCodec.stringify(record));
    }

    private static final class ApiError extends RuntimeException {
        final int status;
        ApiError(int status, String message) { super(message); this.status = status; }
    }

    private record Page(int limit, long offset) {}

    private static Map<String, String> query(HttpExchange exchange) {
        Map<String, String> params = new HashMap<>();
        String raw = exchange.getRequestURI().getRawQuery();
        if (raw == null || raw.isEmpty()) return params;
        try {
            for (String pair : raw.split("&", -1)) {
                String[] parts = pair.split("=", 2);
                String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
                String value = parts.length == 2 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
                if (params.putIfAbsent(key, value) != null) throw new ApiError(400, "Repeated query parameter");
            }
        } catch (IllegalArgumentException error) { throw new ApiError(400, "Malformed query"); }
        return params;
    }

    private static long integer(String text) {
        if (!text.matches("[0-9]{1,16}")) throw new ApiError(400, "Pagination requires decimal integers");
        long value = Long.parseLong(text);
        if (value > 9007199254740991L) throw new ApiError(400, "Pagination out of range");
        return value;
    }

    private static Page page(Map<String, String> params, boolean allowStatus) {
        Set<String> allowed = allowStatus ? Set.of("limit", "offset", "status") : Set.of("limit", "offset");
        if (!allowed.containsAll(params.keySet())) throw new ApiError(400, "Unknown query parameter");
        long limit = integer(params.getOrDefault("limit", "20"));
        long offset = integer(params.getOrDefault("offset", "0"));
        if (limit < 1 || limit > 100) throw new ApiError(400, "Limit must be between 1 and 100");
        if (params.containsKey("status") && !Set.of("Stable", "Monitor", "Attention").contains(params.get("status"))) throw new ApiError(400, "Invalid status");
        return new Page((int) limit, offset);
    }

    private static Object paginate(Object value, Page page, String path, Map<String, Object> metadata) {
        if (value instanceof List<?> items) {
            int start = (int) Math.min(page.offset, items.size());
            int end = Math.min(start + page.limit, items.size());
            metadata.put(path, Map.of("limit", page.limit, "offset", page.offset, "total", items.size(), "returned", end - start, "hasMore", end < items.size()));
            List<Object> result = new ArrayList<>();
            for (int i = start; i < end; i++) result.add(paginate(items.get(i), page, path + "[" + i + "]", metadata));
            return result;
        }
        if (value instanceof Map<?, ?> object) {
            Map<String, Object> result = new LinkedHashMap<>();
            for (var entry : object.entrySet()) result.put(entry.getKey().toString(), paginate(entry.getValue(), page, path.isEmpty() ? entry.getKey().toString() : path + "." + entry.getKey(), metadata));
            return result;
        }
        return value;
    }

    private static Map<String, Object> paged(Map<String, Object> payload, Page page) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        Map<String, Object> result = castMap(paginate(payload, page, "", metadata));
        result.put("collections", metadata);
        if (metadata.containsKey("data")) result.put("pagination", metadata.get("data"));
        return result;
    }

    private static void validateBody(HttpExchange exchange, boolean refresh) throws IOException {
        byte[] body = exchange.getRequestBody().readNBytes(102401);
        if (body.length > 102400) throw new ApiError(413, "Request body too large");
        if (body.length == 0) return;
        if (!refresh) throw new ApiError(400, "This endpoint does not accept a body");
        String type = exchange.getRequestHeaders().getFirst("Content-Type");
        if (type == null || !type.split(";", 2)[0].trim().equalsIgnoreCase("application/json")) throw new ApiError(415, "Content-Type must be application/json");
        try {
            Object parsed = JsonCodec.parse(decodeUtf8(body));
            if (!(parsed instanceof Map<?, ?> object) || !object.isEmpty()) throw new ApiError(400, "Refresh expects an empty object");
        } catch (IOException | RuntimeException error) { throw new ApiError(400, "Malformed refresh body"); }
    }

    private static Map<String, Object> route(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        Map<String, String> params = query(exchange);
        boolean refresh = path.equals("/api/dataset/refresh");
        String method = exchange.getRequestMethod();
        if (!method.equals("GET") && !(refresh && method.equals("POST"))) {
            exchange.getResponseHeaders().set("Allow", refresh ? "GET, POST" : "GET");
            throw new ApiError(405, "Method not allowed");
        }
        validateBody(exchange, refresh);
        if (refresh) {
            if (!params.isEmpty()) throw new ApiError(400, "Refresh does not accept query parameters");
            clearCache();
            return Map.of("status", "success", "message", "Java dataset cache refreshed");
        }
        if (path.equals("/health") || path.equals("/api/health") || path.equals("/api/dataset/keys")) {
            if (!params.isEmpty()) throw new ApiError(400, "Endpoint does not accept query parameters");
            return path.endsWith("/keys") ? datasetKeysPayload() : healthPayload();
        }
        Page page = page(params, path.equals("/api/dataset/astronauts"));
        if (path.equals("/api/telemetry/live")) return paged(telemetryPayload(), page);
        if (path.equals("/api/dataset")) {
            Map<String, Object> data = new LinkedHashMap<>();
            for (String key : DATASET_KEYS) if (!key.equals("weather")) data.put(key, loadDataset(key));
            return paged(Map.of("status", "success", "data", data), page);
        }
        String[] parts = path.split("/", -1);
        if (parts.length == 4 && parts[1].equals("api") && parts[2].equals("dataset")) {
            if (!DATASET_KEYS.contains(parts[3])) throw new ApiError(400, "Invalid dataset key");
            Object data = loadDataset(parts[3]);
            if (params.containsKey("status")) data = castList(data).stream().filter(item -> params.get("status").equals(castMap(item).get("status"))).toList();
            return paged(Map.of("status", "success", "data", data), page);
        }
        if (parts.length == 5 && parts[1].equals("api") && parts[2].equals("dataset") && parts[3].equals("astronauts")) {
            if (!parts[4].matches("ast_[0-9]{3}")) throw new ApiError(400, "Invalid astronaut id");
            for (Object item : castList(loadDataset("astronauts"))) if (parts[4].equals(castMap(item).get("id"))) return Map.of("status", "success", "data", item);
            throw new ApiError(404, "Astronaut not found");
        }
        throw new ApiError(404, "Endpoint not found");
    }

    private static class ApiHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            String requestId = UUID.randomUUID().toString();
            long start = System.nanoTime();
            int status = 200;
            exchange.getResponseHeaders().set("X-Request-Id", requestId);
            try {
                Map<String, Object> payload;
                try { payload = route(exchange); }
                catch (ApiError error) {
                    status = error.status;
                    log("request_error", Map.of("requestId", requestId, "status", status, "message", error.getMessage()));
                    payload = Map.of("status", "error", "message", error.getMessage());
                } catch (Exception error) {
                    status = 500;
                    log("service_failure", Map.of("requestId", requestId, "error", error.toString()));
                    payload = Map.of("status", "error", "message", "Internal server error");
                }
                byte[] body = JsonCodec.stringify(payload).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
                exchange.sendResponseHeaders(status, body.length);
                try (OutputStream out = exchange.getResponseBody()) { out.write(body); }
            } catch (IOException error) {
                log("response_failure", Map.of("requestId", requestId, "error", error.toString()));
            } finally {
                log("request", Map.of("requestId", requestId, "method", exchange.getRequestMethod(), "path", exchange.getRequestURI().getPath(), "status", status, "durationMs", (System.nanoTime() - start) / 1_000_000.0));
                exchange.close();
            }
        }
    }

    private static class JsonCodec {
        private final String input;
        private int pos;
        private int depth;

        private JsonCodec(String input) {
            this.input = input;
            this.pos = 0;
        }

        static Object parse(String json) {
            JsonCodec codec = new JsonCodec(json);
            codec.skipWhitespace();
            Object value = codec.parseValue();
            codec.skipWhitespace();
            if (codec.pos != json.length()) throw new IllegalStateException("Trailing JSON data");
            return value;
        }

        static String stringify(Object value) {
            if (value == null) {
                return "null";
            }
            if (value instanceof String) {
                return quote((String) value);
            }
            if (value instanceof Number || value instanceof Boolean) {
                return value.toString();
            }
            if (value instanceof Map) {
                StringBuilder builder = new StringBuilder();
                builder.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                    if (!first) builder.append(',');
                    first = false;
                    builder.append(quote(entry.getKey().toString()));
                    builder.append(':');
                    builder.append(stringify(entry.getValue()));
                }
                builder.append('}');
                return builder.toString();
            }
            if (value instanceof List) {
                StringBuilder builder = new StringBuilder();
                builder.append('[');
                boolean first = true;
                for (Object item : (List<?>) value) {
                    if (!first) builder.append(',');
                    first = false;
                    builder.append(stringify(item));
                }
                builder.append(']');
                return builder.toString();
            }
            return quote(value.toString());
        }

        private static String quote(String text) {
            StringBuilder sb = new StringBuilder();
            sb.append('"');
            for (char c : text.toCharArray()) {
                switch (c) {
                    case '"' -> sb.append("\\\"");
                    case '\\' -> sb.append("\\\\");
                    case '\b' -> sb.append("\\b");
                    case '\f' -> sb.append("\\f");
                    case '\n' -> sb.append("\\n");
                    case '\r' -> sb.append("\\r");
                    case '\t' -> sb.append("\\t");
                    default -> {
                        if (c < 0x20 || c > 0x7E) {
                            sb.append(String.format("\\u%04x", (int) c));
                        } else {
                            sb.append(c);
                        }
                    }
                }
            }
            sb.append('"');
            return sb.toString();
        }

        private Object parseValue() {
            skipWhitespace();
            if (pos >= input.length()) {
                throw new IllegalStateException("Unexpected end of JSON input");
            }
            char c = input.charAt(pos);
            if (++depth > 64) throw new IllegalStateException("JSON nesting too deep");
            try { return switch (c) {
                case '{' -> parseObject();
                case '[' -> parseArray();
                case '"' -> parseString();
                case 't' -> parseLiteral("true", Boolean.TRUE);
                case 'f' -> parseLiteral("false", Boolean.FALSE);
                case 'n' -> parseLiteral("null", null);
                default -> parseNumber();
            }; } finally { depth--; }
        }

        private Map<String, Object> parseObject() {
            Map<String, Object> object = new HashMap<>();
            expect('{');
            skipWhitespace();
            if (peek() == '}') {
                expect('}');
                return object;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                skipWhitespace();
                if (object.containsKey(key)) throw new IllegalStateException("Duplicate JSON key");
                object.put(key, parseValue());
                skipWhitespace();
                if (peek() == ',') {
                    expect(',');
                    continue;
                }
                break;
            }
            expect('}');
            return object;
        }

        private List<Object> parseArray() {
            List<Object> list = new ArrayList<>();
            expect('[');
            skipWhitespace();
            if (peek() == ']') {
                expect(']');
                return list;
            }
            while (true) {
                skipWhitespace();
                list.add(parseValue());
                skipWhitespace();
                if (peek() == ',') {
                    expect(',');
                    continue;
                }
                break;
            }
            expect(']');
            return list;
        }

        private String parseString() {
            expect('"');
            StringBuilder builder = new StringBuilder();
            while (true) {
                if (pos >= input.length()) {
                    throw new IllegalStateException("Unterminated string");
                }
                char c = input.charAt(pos++);
                if (c == '"') {
                    break;
                }
                if (c == '\\') {
                    if (pos >= input.length()) {
                        throw new IllegalStateException("Unterminated escape in string");
                    }
                    char escaped = input.charAt(pos++);
                    switch (escaped) {
                        case '"' -> builder.append('"');
                        case '\\' -> builder.append('\\');
                        case '/' -> builder.append('/');
                        case 'b' -> builder.append('\b');
                        case 'f' -> builder.append('\f');
                        case 'n' -> builder.append('\n');
                        case 'r' -> builder.append('\r');
                        case 't' -> builder.append('\t');
                        case 'u' -> {
                            String hex = input.substring(pos, pos + 4);
                            builder.append((char) Integer.parseInt(hex, 16));
                            pos += 4;
                        }
                        default -> throw new IllegalStateException("Invalid JSON escape");
                    }
                    continue;
                }
                if (c < 0x20) throw new IllegalStateException("Unescaped control character");
                builder.append(c);
            }
            return builder.toString();
        }

        private Object parseNumber() {
            var matcher = java.util.regex.Pattern.compile("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?").matcher(input);
            matcher.region(pos, input.length());
            if (!matcher.lookingAt()) throw new IllegalStateException("Invalid JSON number");
            String text = matcher.group();
            pos = matcher.end();
            double number = Double.parseDouble(text);
            if (!Double.isFinite(number)) throw new IllegalStateException("Non-finite JSON number");
            return number;
        }

        private Object parseLiteral(String literal, Object value) {
            if (!input.startsWith(literal, pos)) {
                throw new IllegalStateException("Expected literal " + literal);
            }
            pos += literal.length();
            return value;
        }

        private void skipWhitespace() {
            while (pos < input.length() && " \t\r\n".indexOf(peek()) >= 0) {
                pos++;
            }
        }

        private char peek() {
            return pos < input.length() ? input.charAt(pos) : '\0';
        }

        private void expect(char expected) {
            if (peek() != expected) {
                throw new IllegalStateException("Expected '" + expected + "' at position " + pos);
            }
            pos++;
        }
    }
}
