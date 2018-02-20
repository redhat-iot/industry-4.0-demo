package com.redhat.iot.demo.jpmml;

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
public class ModelRouter implements ConfigurableComponent {

    private static final Logger logger = LoggerFactory.getLogger(ModelRouter.class);

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
        final BundleContext ctx = FrameworkUtil.getBundle(ModelRouter.class).getBundleContext();

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

        // Totally disable until we figure out if this is even needed
        return NO_ROUTES;

/*
        return new RouteBuilder() {
            @Override
            public void configure() throws Exception {

                // This needs to be converted to MQTT
                from("kafka:model?brokers=34.212.173.140:9092&groupId=kapua_test")
                        .to("log:model")
                        .process(exchange -> {
                            System.out.println("FIRST" + "\n");

                            String messageKey = "";
                            if (exchange.getIn() != null) {
                                Message message = exchange.getIn();
                                Integer partitionId = (Integer) message
                                        .getHeader(KafkaConstants.PARTITION);
                                String topicName = (String) message
                                        .getHeader(KafkaConstants.TOPIC);
                                if (message.getHeader(KafkaConstants.KEY) != null)
                                    messageKey = (String) message
                                            .getHeader(KafkaConstants.KEY);
                                Object data = message.getBody();

                                System.out.println("topicName :: "
                                        + topicName + " partitionId :: "
                                        + partitionId + " messageKey :: "
                                        + messageKey + " message :: "
                                        + data + "\n");
                            }
                        }).to("log:model");

            }
        };
*/
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