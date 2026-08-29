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
import java.util.Iterator;
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

    private static final char DEGREE = '\u00B0';
    private static final Map<String, CacheEntry> CACHE = new HashMap<>();
    private static final Path DATA_FOLDER = resolveDataFolder();

    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 5002), 0);
        server.createContext("/health", new SimpleHandler(JavaBackend::healthPayload));
        server.createContext("/api/health", new SimpleHandler(JavaBackend::healthPayload));
        server.createContext("/api/dataset/keys", new SimpleHandler(JavaBackend::datasetKeysPayload));
        server.createContext("/api/dataset", new DynamicDatasetHandler());
        server.createContext("/api/telemetry/live", new SimpleHandler(JavaBackend::telemetryPayload));

        server.setExecutor(null);
        System.out.println("Java backend listening on http://127.0.0.1:5002");
        server.start();
    }

    private static Path resolveDataFolder() {
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
        Map<String, Object> iss = loadDataset("iss");
        Map<String, Object> spaceWeather = loadDataset("spaceWeather");
        List<Object> astronauts = castList(loadDataset("astronauts"));
        Map<String, Object> rocket = loadDataset("rocket");
        Map<String, Object> nasa = loadDataset("nasa");
        Map<String, Object> mission = loadDataset("mission");

        int astronautHealth = averageInt(astronauts, "healthScore");
        int rocketHealth = getInt(rocket, "healthScore");
        String astronautStatus = astronautHealth >= 92 ? "Stable" : astronautHealth >= 84 ? "Monitor" : "Attention";
        String rocketStatus = rocketHealth >= 92 ? "Stable" : rocketHealth >= 84 ? "Monitor" : "Attention";

        Map<String, Object> primaryAstronaut = castMap(astronauts.get(0));
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
        snapshot.put("missionStatus", String.format("%s • %s", getString(mission, "missionName"), getString(mission, "phase")));
        snapshot.put("orbit", String.format("%s / %.4f%c, %.4f%c • Alt: %.1f km", getString(iss, "name"), getDouble(iss, "latitude"), DEGREE, getDouble(iss, "longitude"), DEGREE, getDouble(iss, "altitude")));
        snapshot.put("weather", String.format("%s • %s", getString(spaceWeather, "status"), getString(spaceWeather, "description")));
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

    private static Map<String, Object> loadDataset(String key) {
        String normalizedKey = key.equals("weather") ? "spaceWeather" : key;
        if (!DATASET_FILES.containsKey(normalizedKey)) {
            throw new IllegalArgumentException("Unknown dataset key: " + key);
        }

        Path file = DATA_FOLDER.resolve(DATASET_FILES.get(normalizedKey));
        if (!Files.exists(file)) {
            throw new IllegalStateException("Dataset file is not available: " + file);
        }

        try {
            long mtime = Files.getLastModifiedTime(file).toMillis();
            CacheEntry cache = CACHE.get(normalizedKey);
            if (cache != null && cache.mtime == mtime) {
                return cache.data;
            }

            String json = Files.readString(file, StandardCharsets.UTF_8);
            Object parsed = JsonCodec.parse(json);
            if (!(parsed instanceof Map)) {
                throw new IllegalStateException("Dataset did not decode to an object for key " + key);
            }

            Map<String, Object> typed = castMap(parsed);
            CACHE.put(normalizedKey, new CacheEntry(typed, mtime));
            return typed;
        } catch (IOException e) {
            throw new RuntimeException("Unable to load dataset " + key, e);
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

    private static String toJson(Map<String, Object> payload) {
        return JsonCodec.stringify(payload);
    }

    private static void writeResponse(HttpExchange exchange, int statusCode, String responseBody) throws IOException {
        byte[] bodyBytes = responseBody.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, bodyBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bodyBytes);
        }
    }

    private static class CacheEntry {
        Map<String, Object> data;
        long mtime;

        CacheEntry(Map<String, Object> data, long mtime) {
            this.data = data;
            this.mtime = mtime;
        }
    }

    private static class SimpleHandler implements HttpHandler {
        private final PayloadSupplier payloadSupplier;

        SimpleHandler(PayloadSupplier payloadSupplier) {
            this.payloadSupplier = payloadSupplier;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String response = toJson(payloadSupplier.get());
                writeResponse(exchange, 200, response);
            } catch (RuntimeException ex) {
                String error = JsonCodec.stringify(Map.of("status", "error", "message", ex.getMessage()));
                writeResponse(exchange, 500, error);
            } finally {
                exchange.close();
            }
        }
    }

    private static class DynamicDatasetHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String path = exchange.getRequestURI().getPath();
                if (("POST".equalsIgnoreCase(exchange.getRequestMethod()) || "GET".equalsIgnoreCase(exchange.getRequestMethod())) && "/api/dataset/refresh".equals(path)) {
                    CACHE.clear();
                    String response = JsonCodec.stringify(Map.of("status", "success", "message", "Java dataset cache refreshed"));
                    writeResponse(exchange, 200, response);
                    return;
                }

                String[] segments = path.split("/");
                if (segments.length == 4 && "api".equals(segments[1]) && "dataset".equals(segments[2]) && "keys".equals(segments[3])) {
                    String response = toJson(datasetKeysPayload());
                    writeResponse(exchange, 200, response);
                    return;
                }

                if (segments.length >= 4 && "api".equals(segments[1]) && "dataset".equals(segments[2])) {
                    if (segments.length == 4) {
                        String datasetKey = segments[3];
                        Object data = loadDataset(datasetKey);
                        String response = JsonCodec.stringify(Map.of("status", "success", "data", data));
                        writeResponse(exchange, 200, response);
                        return;
                    }
                    if (segments.length == 5 && "astronauts".equals(segments[3])) {
                        String astronautId = segments[4];
                        List<Object> astronauts = castList(loadDataset("astronauts"));
                        Object found = null;
                        for (Object item : astronauts) {
                            Map<String, Object> astronaut = castMap(item);
                            if (astronautId.equals(astronaut.get("id"))) {
                                found = astronaut;
                                break;
                            }
                        }
                        if (found == null) {
                            String response = JsonCodec.stringify(Map.of("status", "error", "message", "Astronaut " + astronautId + " not found"));
                            writeResponse(exchange, 404, response);
                            return;
                        }
                        String response = JsonCodec.stringify(Map.of("status", "success", "data", found));
                        writeResponse(exchange, 200, response);
                        return;
                    }
                }

                if ("GET".equalsIgnoreCase(exchange.getRequestMethod()) && "/api/dataset".equals(path)) {
                    Map<String, Object> allData = new HashMap<>();
                    for (String key : DATASET_KEYS) {
                        if ("weather".equals(key)) {
                            continue;
                        }
                        allData.put(key, loadDataset(key));
                    }
                    String response = JsonCodec.stringify(Map.of("status", "success", "message", "Complete mission dataset loaded from local files", "data", allData));
                    writeResponse(exchange, 200, response);
                    return;
                }

                String response = JsonCodec.stringify(Map.of("status", "error", "message", "Endpoint not found"));
                writeResponse(exchange, 404, response);
            } catch (RuntimeException ex) {
                String error = JsonCodec.stringify(Map.of("status", "error", "message", ex.getMessage()));
                writeResponse(exchange, 500, error);
            } finally {
                exchange.close();
            }
        }
    }

    @FunctionalInterface
    private interface PayloadSupplier {
        Map<String, Object> get();
    }

    private static class JsonCodec {
        private final String input;
        private int pos;

        private JsonCodec(String input) {
            this.input = input;
            this.pos = 0;
        }

        static Object parse(String json) {
            JsonCodec codec = new JsonCodec(json);
            codec.skipWhitespace();
            Object value = codec.parseValue();
            codec.skipWhitespace();
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
            return switch (c) {
                case '{' -> parseObject();
                case '[' -> parseArray();
                case '"' -> parseString();
                case 't' -> parseLiteral("true", Boolean.TRUE);
                case 'f' -> parseLiteral("false", Boolean.FALSE);
                case 'n' -> parseLiteral("null", null);
                default -> parseNumber();
            };
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
                        default -> builder.append(escaped);
                    }
                    continue;
                }
                builder.append(c);
            }
            return builder.toString();
        }

        private Object parseNumber() {
            int start = pos;
            if (peek() == '-') {
                pos++;
            }
            while (pos < input.length() && Character.isDigit(peek())) {
                pos++;
            }
            boolean isDouble = false;
            if (peek() == '.') {
                isDouble = true;
                pos++;
                while (pos < input.length() && Character.isDigit(peek())) {
                    pos++;
                }
            }
            if (peek() == 'e' || peek() == 'E') {
                isDouble = true;
                pos++;
                if (peek() == '+' || peek() == '-') {
                    pos++;
                }
                while (pos < input.length() && Character.isDigit(peek())) {
                    pos++;
                }
            }
            String numberText = input.substring(start, pos);
            if (isDouble) {
                return Double.parseDouble(numberText);
            }
            return Long.parseLong(numberText);
        }

        private Object parseLiteral(String literal, Object value) {
            if (!input.startsWith(literal, pos)) {
                throw new IllegalStateException("Expected literal " + literal);
            }
            pos += literal.length();
            return value;
        }

        private void skipWhitespace() {
            while (pos < input.length() && Character.isWhitespace(peek())) {
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
