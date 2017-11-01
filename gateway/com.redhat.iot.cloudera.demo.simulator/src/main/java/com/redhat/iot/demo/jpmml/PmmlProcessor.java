package com.redhat.iot.demo.jpmml;

import com.google.gson.Gson;
import org.apache.camel.Exchange;
import org.apache.camel.ExchangePattern;
import org.apache.camel.Processor;
import org.apache.camel.builder.SimpleBuilder;
import org.dmg.pmml.FieldName;
import org.dmg.pmml.PMML;
import org.eclipse.kura.core.message.protobuf.KuraPayloadProto;
import org.jpmml.evaluator.*;
import org.jpmml.model.PMMLUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xml.sax.SAXException;

import javax.xml.bind.JAXBException;
import java.io.*;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class PmmlProcessor implements Processor {
    private static final Logger logger = LoggerFactory.getLogger(PmmlProcessor.class);

    public PMML getPmml() {
        return pmml;
    }

    public void setPmml(PMML pmml) {
        this.pmml = pmml;
    }

    private PMML pmml = null;

    public PmmlProcessor(PMML pmml) {
        this.pmml = pmml;

    }

   public void process(Exchange exchange) {

       if (null != pmml) {
           ModelEvaluatorFactory modelEvaluatorFactory = ModelEvaluatorFactory.newInstance();
           ModelEvaluator<?> modelEvaluator = modelEvaluatorFactory.newModelEvaluator(pmml);

           KuraPayloadProto.KuraPayload kuraPayload = exchange.getIn().getBody(KuraPayloadProto.KuraPayload.class);
           Map<FieldName, FieldValue> arguments = new LinkedHashMap<>();
           List<InputField> inputFields = modelEvaluator.getInputFields();

           Map<String, Double> metrics = new HashMap<>();

           for (KuraPayloadProto.KuraPayload.KuraMetric metric : kuraPayload.getMetricList()) {
               metrics.put(metric.getName(), metric.getDoubleValue());
           }
           for (int x=0;x< inputFields.size();x++) {
               InputField inputField = inputFields.get(x);
               FieldName inputFieldName = inputField.getName();

               Object rawValue = metrics.get(inputFieldName.getValue());
               FieldValue inputFieldValue = inputField.prepare(rawValue);

               arguments.put(inputFieldName, inputFieldValue);
           }

           Map<FieldName, ?> eval = ((Evaluator) modelEvaluator).evaluate(arguments);

           double p0 = (Double) eval.get(FieldName.create("probability(0)"));
           double p1 = (Double) eval.get(FieldName.create("probability(1)"));
           double p2 = (Double) eval.get(FieldName.create("probability(2)"));
           logger.debug("Tests: " + p0 + " : " + p1 + " : " + p2);
           if (p0 == 1.0) {
               exchange.getIn().setHeader("demo.modenumber", 0);
           } else if (p2 >= 0.3) {
               exchange.getIn().setHeader("demo.modenumber", 2);
               exchange.getIn().setBody("{\"id\": \"D846E916-FA87-4ACE-97A6-D0C91C5116C6\",\"description\": \"Bad Power Supply\",\"timestamp\": 1503599719963,\"type\": \"error\",\"details\": {\"reason\": \"Alert: Machine predicted in state ROTOR_LOCK with immediate failure.\"}}");
           }

       } else {
           logger.info("pmml was null");
       }

   }
}
