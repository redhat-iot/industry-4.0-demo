package com.redhat.iot.demo.jpmml;

import com.redhat.iot.demo.simulator.GatewayRouter;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.apache.camel.ServiceStatus;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.dataformat.csv.CsvDataFormat;
import org.apache.camel.model.dataformat.ProtobufDataFormat;
import org.dmg.pmml.PMML;
import org.eclipse.kura.camel.cloud.KuraCloudComponent;
import org.eclipse.kura.camel.component.Configuration;
import org.eclipse.kura.camel.runner.CamelRunner;
import org.eclipse.kura.camel.runner.ServiceConsumer;
import org.eclipse.kura.cloud.CloudService;
import org.eclipse.kura.configuration.ConfigurableComponent;
import org.eclipse.kura.core.message.protobuf.KuraPayloadProto;
import org.eclipse.kura.message.KuraPayload;
import org.jpmml.model.PMMLUtil;
import org.osgi.framework.BundleContext;
import org.osgi.framework.Constants;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.InvalidSyntaxException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xml.sax.SAXException;

import javax.xml.bind.JAXBException;
import java.io.*;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.eclipse.kura.camel.component.Configuration.*;

/**
 * Example of the Kura Camel application.
 */
public class OpenScoringRouter implements ConfigurableComponent {

    private static final Logger logger = LoggerFactory.getLogger(OpenScoringRouter.class);

    private static String KURA = "cloud:";
    private static String TOPIC = "simulator-test/assets";
    private static Map<String, String> machineState;

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
        final BundleContext ctx = FrameworkUtil.getBundle(OpenScoringRouter.class).getBundleContext();

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

        File file = new File(asString(properties, "pmml.file"));
        PMML pmml = null;

        try (InputStream is = new FileInputStream(file)) {
            pmml = PMMLUtil.unmarshal(is);

        } catch (FileNotFoundException fnf) {
            fnf.printStackTrace();
        } catch (IOException ioe) {
            ioe.printStackTrace();
        } catch (SAXException sae) {
            sae.printStackTrace();
        } catch (JAXBException jae) {
            jae.printStackTrace();
        }

        if (!asBoolean(properties, "enabled")) {
            return NO_ROUTES;
        }

        PMML finalPmml = pmml;
        return new RouteBuilder() {
            @Override
            public void configure() throws Exception {
                from("mqtt:control?host=tcp://broker-redhat-iot.apps.cloudera-iot-demo.rhiot.org:31883&subscribeTopicName=Red-Hat/+/" + asString(properties, "topic.prefix") + "/+&userName=demo-gw2&password=RedHat123")
                        .routeId("openscoring")
                        .unmarshal().gzip()
                        .unmarshal().protobuf(KuraPayloadProto.KuraPayload.getDefaultInstance())
                        .process(new DemoIdProcessor())
                        .process(new PmmlProcessor(finalPmml))
                        .choice()
//                            .when(header("demo.modenumber").isEqualTo(0))
//                                .log("MODE NUMBER 0: ALL IS GOOD")
                            .when(header("demo.modenumber").isEqualTo(2))
                                .setHeader("CamelMQTTPublishTopic", simple("Red-Hat/cldr-demo-gw/cloudera-demo/facilities/${in.header[demo.facility]}/lines/line-1/machines/${in.header[demo.machine]}/alerts"))
//                                .log("MODE NUMBER 2: SubTopic=${in.header[CamelMQTTPublishTopic]} Machine=${in.header[demo.machine]} Facility=${in.header[demo.facility]}")
                                .to("mqtt:alert?host=tcp://broker-redhat-iot.apps.cloudera-iot-demo.rhiot.org:31883&userName=demo-gw2&password=RedHat123&version=3.1.1&qualityOfService=AtMostOnce")
                        .end();
            }
        };

    }

    private static String getMachineFromTopic(String in) {
        int begin = in.indexOf("machines") + 9;
//        int end = in.indexOf("/", begin);
        return in.substring(begin);
    }

    private static String getFacilityFromTopic(String in) {
        int begin = in.indexOf("facilities") + 11;
        int end = in.indexOf("/", begin);
        return in.substring(begin, end);
    }

    private static class DemoIdProcessor implements Processor {

        @Override public void process(Exchange exchange) throws Exception {
            exchange.getIn().setHeader("demo.machine", getMachineFromTopic((String)exchange.getIn().getHeader("CamelMQTTSubscribeTopic")));
            exchange.getIn().setHeader("demo.facility", getFacilityFromTopic((String)exchange.getIn().getHeader("CamelMQTTSubscribeTopic")));
        }
    }

}