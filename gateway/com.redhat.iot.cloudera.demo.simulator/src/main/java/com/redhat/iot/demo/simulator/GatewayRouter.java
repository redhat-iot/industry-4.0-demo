package com.redhat.iot.demo.simulator;

import org.apache.camel.*;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.dataformat.csv.CsvDataFormat;
import org.eclipse.kura.camel.cloud.KuraCloudComponent;
import org.eclipse.kura.camel.component.Configuration;
import org.eclipse.kura.camel.runner.CamelRunner;
import org.eclipse.kura.camel.runner.ServiceConsumer;
import org.eclipse.kura.cloud.CloudService;
import org.eclipse.kura.configuration.ConfigurableComponent;
import org.eclipse.kura.message.KuraPayload;
import org.osgi.framework.BundleContext;
import org.osgi.framework.Constants;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.InvalidSyntaxException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.eclipse.kura.camel.component.Configuration.*;

/**
 * Example of the Kura Camel application.
 */
public class GatewayRouter implements ConfigurableComponent {

    private static final Logger logger = LoggerFactory.getLogger(GatewayRouter.class);

    private static String KURA = "cloud:";
    private static String TOPIC = "simulator-test/assets";
    private static Map<String, String> machineState;
    private static Processor kuraProcessor = new KuraProcessor();
    private Map<String, Object> properties = null;

    static
    {
        machineState = new HashMap<>();
        machineState.put("machine-1", "normal");
        machineState.put("machine-2", "normal");
        machineState.put("machine-3", "normal");
    }


    /**
     * A RouterBuilder instance which has no routes
     */
    private static final RouteBuilder NO_ROUTES = new RouteBuilder() {

        @Override
        public void configure() throws Exception {
        }
    };

    private CamelRunner camel;

    private String cloudServiceFilter;

    public void start(final Map<String, Object> properties) throws Exception {
        logger.info("Start: {}", properties);

        this.properties = properties;

        // create new filter and instance

        final String cloudServiceFilter = makeCloudServiceFilter(properties);
        this.camel = createCamelRunner(cloudServiceFilter);

        // set routes

        this.camel.setRoutes(fromProperties(properties));

        // start

        this.camel.start();
    }

    public void updated(final Map<String, Object> properties) throws Exception {
        logger.info("Updating: {}", properties);

        final String cloudServiceFilter = makeCloudServiceFilter(properties);
        if (!this.cloudServiceFilter.equals(cloudServiceFilter)) {
            // update the routes and the filter

            // stop the camel context first
            this.camel.stop();

            // create a new camel runner, with new dependencies
            this.camel = createCamelRunner(cloudServiceFilter);

            // set the routes
            this.camel.setRoutes(fromProperties(properties));

            // and restart again
            this.camel.start();
        } else {
            // only update the routes, this is done without restarting the context

            this.camel.setRoutes(fromProperties(properties));
        }
    }

    public void stop() throws Exception {
        if (this.camel != null) {
            this.camel.stop();
            this.camel = null;
        }
    }

    private CamelRunner createCamelRunner(final String fullFilter) throws InvalidSyntaxException {
        final BundleContext ctx = FrameworkUtil.getBundle(GatewayRouter.class).getBundleContext();

        this.cloudServiceFilter = fullFilter;

        // create a new camel CamelRunner.Builder

        final CamelRunner.Builder builder = new CamelRunner.Builder();

        // add service dependency

        builder.dependOn(ctx, FrameworkUtil.createFilter(fullFilter),
                new ServiceConsumer<CloudService, CamelContext>() {

                    @Override
                    public void consume(final CamelContext context, final CloudService service) {
                        context.addComponent("cloud", new KuraCloudComponent(context, service));
                    }
                });

        // return un-started instance

        return builder.build();
    }

    /**
     * Construct an OSGi filter for a cloud service instance
     *
     * @param properties
     *            the properties to read from
     * @return the OSGi filter selecting the cloud service instance
     */
    private static String makeCloudServiceFilter(final Map<String, Object> properties) {
        final String filterPid = Configuration.asStringNotEmpty(properties, "cloudService",
                "org.eclipse.kura.cloud.CloudService");
        final String fullFilter = String.format("(&(%s=%s)(kura.service.pid=%s))", Constants.OBJECTCLASS,
                CloudService.class.getName(), filterPid);
        return fullFilter;
    }


    /**
     * Create a new RouteBuilder instance from the properties
     *
     * @param properties
     *            the properties to read from
     * @return the new instance of RouteBuilder
     */
    protected RouteBuilder fromProperties(final Map<String, Object> properties) {

        if (!asBoolean(properties, "enabled")) {
            return NO_ROUTES;
        }

        return new RouteBuilder() {
            @Override
            public void configure() throws Exception {

                // Normal Data
                from(asString(properties, "filespec.normal") + "?include=.*.csv&" + asString(properties, "filespec.options")) //.threads(4) //Poll for file and delete when finished
                        .routeId("normal")
                        .split().tokenize("\\n")//.streaming() //Process each line of the file separately, and stream to keep memory usage down
                        .setHeader("demo.machine", simple("${file:name.noext}"))
                        .process(exchange -> exchange.getIn().setHeader("demo.machineState", machineState.get(exchange.getIn().getHeader("demo.machine"))))
                        .delay(asLong(properties, "interval")).asyncDelayed() //Delay 1 second between processing lines
                        .choice()
                            .when(header("demo.machineState").isEqualTo("normal"))
                                .unmarshal(new CsvDataFormat()
                                    .setIgnoreEmptyLines(true)
                                    .setUseMaps(true)
                                    .setCommentMarker('#')
                                    .setHeader(new String[]{"timestamp", "motorid", "speed", "voltage",
                                            "current", "temp", "noise", "vibration"}))
                                .process(kuraProcessor)
                                .toD("cloud:" + asString(properties, "topic.prefix") + "/${file:name.noext}");


/*
                // Bad Power
                from(asString(properties, "filespec.bad_power")).noAutoStartup()//.threads(12) //Poll for file and delete when finished
                        .routeId("bad_power")
                        .split().tokenize("\\n")//.streaming() //Process each line of the file separately, and stream to keep memory usage down
                        .setHeader("demo.machine", simple("${file:name.noext}"))
                        .process(exchange -> exchange.getIn().setHeader("demo.machineState", machineState.get(exchange.getIn().getHeader("demo.machine"))))
                        .delay(asLong(properties, "interval")).asyncDelayed() //Delay 1 second between processing lines
                        .choice()
                            .when(header("demo.machineState").isEqualTo("simulate_maintenance_required"))
                                .unmarshal(new CsvDataFormat()
                                    .setIgnoreEmptyLines(true)
                                    .setUseMaps(true)
                                    .setCommentMarker('#')
                                    .setHeader(new String[]{"timestamp", "motorid", "speed", "voltage",
                                            "current", "temp", "noise", "vibration"}))
                                .process(kuraProcessor)
                                .toD("cloud:" + asString(properties, "topic.prefix") + "/${file:name.noext}");
*/


/*
                // Bad Rotor Locked Data
                from(asString(properties, "filespec.bad_rotor_locked")).noAutoStartup()//.threads(12) //Poll for file
                        .routeId("bad_rotor_locked")
                        .split().tokenize("\\n")//.streaming()
                        .setHeader("demo.machine", simple("${file:name.noext}"))
                        .process(exchange -> exchange.getIn().setHeader("demo.machineState", machineState.get(exchange.getIn().getHeader("demo.machine"))))
                        .delay(asLong(properties, "interval")).asyncDelayed() //Delay 1 second between processing lines
                            .choice()
                                .when(header("demo.machineState").isEqualTo("simulate_safety_hazard"))
                                    .unmarshal(new CsvDataFormat()
                                        .setIgnoreEmptyLines(true)
                                        .setUseMaps(true)
                                        .setCommentMarker('#')
                                        .setHeader(new String[]{"timestamp", "motorid", "speed", "voltage",
                                                "current", "temp", "noise", "vibration"}))
                                    .process(kuraProcessor)
                                    .toD("cloud:" + asString(properties, "topic.prefix") + "/${file:name.noext}");
*/


                // Control messages
                from("mqtt:control?host=tcp://ec-broker-mqtt.redhat-iot.svc:1883&subscribeTopicName=Red-Hat/+/" + asString(properties, "topic.prefix") + "/+/control&userName=demo-gw2&password=RedHat123!@#")
                    .routeId("control")
                        .process(exchange -> {
                            String control = exchange.getIn().getBody(String.class);
                            String machine = getMachineFromTopic((String)exchange.getIn().getHeader("CamelMQTTSubscribeTopic"));
                            String facility = getFacilityFromTopic((String)exchange.getIn().getHeader("CamelMQTTSubscribeTopic"));
                            exchange.getIn().setHeader("demo.machine", machine);
                            exchange.getIn().setHeader("demo.facility", facility);
                            if (control.contains("reset")) {
                                machineState.put(machine, "normal");
//                                if (!machineState.containsValue("bad_power")) {
                                    exchange.getContext().stopRoute(machine + "bad_power");
//                                }
//                                if (!machineState.containsValue("bad_rotor_locked")) {
                                    exchange.getContext().stopRoute(machine + "bad_rotor_locked");
//                                }
                                logger.info(machine + " now in State 1: Reset to Normal");
                                exchange.getIn().setHeader("sendOK", machine);
                            } else if (control.contains("simulate_maintenance_required")) {
                                machineState.put(machine, "bad_power");
                                ServiceStatus status = exchange.getContext().getRouteStatus(machine + "bad_power");
                                if (null != status && (status == ServiceStatus.Suspended || status == ServiceStatus.Suspending)) {
                                    exchange.getContext().resumeRoute(machine + "bad_power");
                                } else if (null != status && (status == ServiceStatus.Stopped || status == ServiceStatus.Stopping)){
                                    exchange.getContext().startRoute(machine + "bad_power");
//                                    exchange.getContext().startRoute(machine + "bad_power");
                                } else {
                                    exchange.getContext().addRoutes(new BadDataRoutebuilder(machine, "bad_power"));
                                }
                                logger.info(machine + " now in State 2: Maintenance Required");
                            } else if (control.contains("simulate_safety_hazard")) {
                                logger.info("Route state is: " + exchange.getContext().getRouteStatus(machine + "bad_rotor_locked"));
                                machineState.put(machine, "bad_rotor_locked");
                                ServiceStatus status = exchange.getContext().getRouteStatus(machine + "bad_rotor_locked");
                                if (null != status && (status == ServiceStatus.Suspended || status == ServiceStatus.Suspending)) {
                                    exchange.getContext().resumeRoute(machine + "bad_rotor_locked");
                                } else if (null != status && (status == ServiceStatus.Stopped || status == ServiceStatus.Stopping)){
                                    exchange.getContext().startRoute(machine + "bad_rotor_locked");
                                } else {
                                    exchange.getContext().addRoutes(new BadDataRoutebuilder(machine, "bad_rotor_locked"));
                                }
                                logger.info(machine + " now in State 3: Emergency Shutdown");
                            } else {
                                logger.info("Could not recognize control command");
                            }

                        })
                .choice()
                    .when(header("sendOK").isNotNull())
                        .setBody(simple("{\"machine\": \"D846E916-FA87-4ACE-97A6-D0C91C5116C6\",\"description\": \"Everything is OK\",\"timestamp\": 1503599719963,\"type\": \"ok\",\"details\": {\"reason\": \"The machine has recovered.\"}}"))
                        .setHeader("CamelMQTTPublishTopic", simple("Red-Hat/cldr-demo-gw/cloudera-demo/facilities/${in.header[demo.facility]}/lines/line-1/machines/${in.header[demo.machine]}/alerts"))
                        .to("log:Control?showAll=true&multiline=true")
                        .to("mqtt:okalert?host=tcp://ec-broker-mqtt.redhat-iot.svc:1883&userName=demo-gw2&password=RedHat123!@#&version=3.1.1&qualityOfService=AtMostOnce");
//                .to("log:Control?showAll=true&multiline=true");
            }
        };
    }

    private static String getMachineFromTopic(String in) {
        int begin = in.indexOf("machines") + 9;
        int end = in.indexOf("/", begin);
        return in.substring(begin, end);
    }

    private static String getFacilityFromTopic(String in) {
        int begin = in.indexOf("facilities") + 11;
        int end = in.indexOf("/", begin);
        return in.substring(begin, end);
    }

    private static class KuraProcessor implements Processor {

        @Override
        public void process(Exchange exchange) {
            KuraPayload payload = new KuraPayload();
            payload.setTimestamp(new Date());
            List<Map> metrics = (List<Map>) exchange.getIn().getBody();
            Map<String, String> map =  metrics.get(0); //Each line of the file produces a map of name/value pairs, but we only get one line at a time due to the splitter above
            for (Map.Entry<String, String> entry : map.entrySet()) {
                if (!entry.getKey().equalsIgnoreCase("motorid")) {
                    payload.addMetric(entry.getKey(), Double.parseDouble(entry.getValue()));
                }
            }

            exchange.getIn().setBody(payload);
        }
    }

    public class BadDataRoutebuilder extends RouteBuilder {

        private final String machine;
        private String mode;

        public BadDataRoutebuilder(String machine, String mode) {
            this.machine = machine;
            this.mode = mode;
        }

        public void configure() {
            // Bad Rotor Locked Data
            from(asString(properties, "filespec.bad") + mode + "?include=" + machine + ".csv&" + asString(properties, "filespec.options")) //.noAutoStartup()//.threads(12) //Poll for file
                    .routeId(this.machine + this.mode)
                    .split().tokenize("\\n")//.streaming()
                    .setHeader("demo.machine", simple("${file:name.noext}"))
                    .process(exchange -> exchange.getIn().setHeader("demo.machineState", machineState.get(exchange.getIn().getHeader("demo.machine"))))
                    .delay(asLong(properties, "interval")).asyncDelayed() //Delay 1 second between processing lines
                    .choice()
                    .when(header("demo.machineState").isEqualTo(mode))
                    .unmarshal(new CsvDataFormat()
                            .setIgnoreEmptyLines(true)
                            .setUseMaps(true)
                            .setCommentMarker('#')
                            .setHeader(new String[]{"timestamp", "motorid", "speed", "voltage",
                                    "current", "temp", "noise", "vibration"}))
                    .process(kuraProcessor)
                    .toD("cloud:" + asString(properties, "topic.prefix") + "/${file:name.noext}");
        }
    }


/*
    private static class ControlMessageProcessor implements Processor {

        @Override
        public void process(Exchange exchange) throws Exception {
            if exchange.getContext().route
        }
    }
*/
}