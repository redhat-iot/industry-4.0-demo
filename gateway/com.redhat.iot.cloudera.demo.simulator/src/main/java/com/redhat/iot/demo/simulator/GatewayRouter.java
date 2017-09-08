package com.redhat.iot.demo.simulator;

import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
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

//        final int maxTemp = asInt(properties, "temperature.max", 20);

        return new RouteBuilder() {
            @Override
            public void configure() throws Exception {
                from(asString(properties, "filespec")).threads(12) //Poll for file and delete when finished
                        .split().tokenize("\\n").streaming() //Process each line of the file separately, and stream to keep memory usage down
                        .delay(asLong(properties, "interval")).asyncDelayed() //Delay 1 second between processing lines
                        .log("Sending ${header.CamelSplitIndex} of ${header.CamelSplitSize}")
                        .unmarshal(new CsvDataFormat()
                                .setIgnoreEmptyLines(true)
                                .setUseMaps(true)
                                .setCommentMarker('#')
                                .setHeader(new String[]{"timestamp", "motorid", "speed", "voltage",
                                        "current", "temp", "noise", "vibration"}))
                        .process(new Processor() {
                            @Override
                            public void process(Exchange exchange) throws Exception {
                                KuraPayload payload = new KuraPayload();
                                List<Map> metrics = (List<Map>) exchange.getIn().getBody();
                                Map<String, String> map =  metrics.get(0); //Each line of the file produces a map of name/value pairs, but we only get one line at a time due to the splitter above
                                for (Map.Entry<String, String> entry : map.entrySet()) {
                                    if (!entry.getKey().equalsIgnoreCase("motorid")) {
                                        payload.addMetric(entry.getKey(), Double.parseDouble(entry.getValue()));
                                    }
                                }

                                exchange.getIn().setBody(payload);
                            }
                        })
                        .log("Sending CSV record")
                        .toD("cloud:" + asString(properties, "topic.prefix") + "/${file:name.noext}");

                //                        .to(KURA + TOPIC);

                // Control messages
                from("cloud:cloudera-demo/facilities/facility-1/lines/line-1/machines/+/control")
                        .process(new Processor() {
                            @Override
                            public void process(Exchange exchange) throws Exception {
                                log.info("Exchange is: " + ((KuraPayload)exchange.getIn().getBody()).getBody());
                           }
                        })
                    .log("Expression value for body: ${body}")
                .to("log:Notification?showAll=true&multiline=true");

            }
        };
    }


    private static String getDeviceAddressFromTopic(String in) {
        return in.substring(in.lastIndexOf("/") + 1);
    }

}